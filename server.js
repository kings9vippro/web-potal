const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'AnhKhoi2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Tự động nhận diện thư mục chứa file HTML (dù bạn để ở ngoài hay trong thư mục public)
if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static(path.join(__dirname, 'public')));
} else {
    app.use(express.static(__dirname));
}

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                {
                    id: 'AK_001',
                    username: 'anhkhoi',
                    password: '2102',
                    displayName: 'Phạm Anh Khôi',
                    email: 'dev.anhkhoi@gmail.com',
                    balance: 500000,
                    vipLevel: 'SIÊU VIP KIM CƯƠNG',
                    vipExpire: 'Vô Thời Hạn',
                    avatar: '',
                    provider: 'Hệ thống',
                    createdAt: '2026-10-04 10:00'
                }
            ],
            deposits: [],
            keys: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { users: [], deposits: [], keys: [] };
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// 1. Đăng ký
app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ status: 'error', message: 'Vui lòng điền đủ thông tin!' });
    }
    const db = loadDB();
    const exists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        return res.status(400).json({ status: 'error', message: 'Tài khoản hoặc Email đã tồn tại!' });
    }
    const newUser = {
        id: 'AK_' + Date.now().toString().slice(-6),
        username,
        password,
        displayName: displayName || username,
        email,
        balance: 0,
        vipLevel: 'Thành Viên',
        vipExpire: 'Chưa kích hoạt',
        avatar: '',
        provider: 'Tài khoản thường',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    db.users.push(newUser);
    saveDB(db);
    return res.json({ status: 'success', message: 'Đăng ký thành công!', user: newUser });
});

// 2. Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    const db = loadDB();
    const user = db.users.find(u => (u.username.toLowerCase() === loginId.toLowerCase() || u.email.toLowerCase() === loginId.toLowerCase()) && u.password === password);
    if (!user) {
        return res.status(401).json({ status: 'error', message: 'Sai tên đăng nhập, email hoặc mật khẩu!' });
    }
    return res.json({ status: 'success', message: 'Đăng nhập thành công!', user });
});

// 3. Đăng nhập Google / GitHub
app.post('/api/auth/social', (req, res) => {
    const { provider, email, name, avatar } = req.body;
    const db = loadDB();
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        user = {
            id: 'AK_' + Date.now().toString().slice(-6),
            username: email.split('@')[0] + '_' + provider.toLowerCase(),
            password: 'OAuth_' + Math.random().toString(36),
            displayName: name || 'Khách ' + provider,
            email: email,
            balance: 0,
            vipLevel: 'Thành Viên',
            vipExpire: 'Chưa kích hoạt',
            avatar: avatar || '',
            provider: provider,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        db.users.push(user);
        saveDB(db);
    }
    return res.json({ status: 'success', message: `Đăng nhập ${provider} thành công!`, user });
});

// 4. Đổi Avatar & Thông tin
app.post('/api/user/update', (req, res) => {
    const { userId, displayName, avatar, oldPassword, newPassword } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tài khoản!' });

    if (displayName) user.displayName = displayName;
    if (avatar !== undefined) user.avatar = avatar;
    if (newPassword) {
        if (user.password !== oldPassword) {
            return res.status(400).json({ status: 'error', message: 'Mật khẩu cũ không chính xác!' });
        }
        user.password = newPassword;
    }
    saveDB(db);
    return res.json({ status: 'success', message: 'Cập nhật thành công!', user });
});

// 5. Nạp tiền
app.post('/api/deposit/create', (req, res) => {
    const { userId, amount } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Tài khoản không hợp lệ!' });

    const newDeposit = {
        id: 'PAY_' + Math.floor(100000 + Math.random() * 900000),
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        amount: Number(amount),
        status: 'Chờ duyệt',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    db.deposits.unshift(newDeposit);
    saveDB(db);
    return res.json({ status: 'success', deposit: newDeposit });
});

// 6. Nhập Key VIP
app.post('/api/key/redeem', (req, res) => {
    const { userId, keyCode } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Tài khoản không hợp lệ!' });

    const key = db.keys.find(k => k.code === keyCode.trim().toUpperCase() && !k.isUsed);
    if (!key) return res.status(400).json({ status: 'error', message: 'Mã Key không đúng hoặc đã qua sử dụng!' });

    key.isUsed = true;
    key.usedBy = user.username;
    user.vipLevel = key.vipName;
    user.vipExpire = key.duration;
    saveDB(db);
    return res.json({ status: 'success', message: `Kích hoạt thành công gói ${key.vipName}!`, user });
});

// 7. Mua VIP bằng số dư
app.post('/api/vip/buy', (req, res) => {
    const { userId, packageName, price, duration } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Tài khoản không hợp lệ!' });
    if (user.balance < price) return res.status(400).json({ status: 'error', message: 'Số dư không đủ!' });

    user.balance -= price;
    user.vipLevel = packageName;
    user.vipExpire = duration;
    saveDB(db);
    return res.json({ status: 'success', message: `Nâng cấp thành công gói ${packageName}!`, user });
});

// CỔNG ADMIN DUYỆT TIỀN & TẠO KEY
function authAdmin(req, res, next) {
    const token = req.headers['x-admin-key'] || req.query.admin_key;
    if (token !== ADMIN_SECRET) return res.status(403).json({ status: 'error', message: 'Từ chối truy cập!' });
    next();
}

app.get('/api/admin/overview', authAdmin, (req, res) => {
    const db = loadDB();
    res.json({ status: 'success', users: db.users, deposits: db.deposits, keys: db.keys });
});

app.post('/api/admin/deposit/action', authAdmin, (req, res) => {
    const { depositId, action } = req.body;
    const db = loadDB();
    const deposit = db.deposits.find(d => d.id === depositId);
    if (!deposit || deposit.status !== 'Chờ duyệt') return res.status(400).json({ status: 'error', message: 'Giao dịch không hợp lệ!' });

    if (action === 'approve') {
        const user = db.users.find(u => u.id === deposit.userId);
        if (user) user.balance += deposit.amount;
        deposit.status = 'Đã cộng tiền';
    } else {
        deposit.status = 'Từ chối';
    }
    saveDB(db);
    res.json({ status: 'success', message: 'Thao tác thành công!' });
});

app.post('/api/admin/keys/create', authAdmin, (req, res) => {
    const { vipName, duration, count } = req.body;
    const db = loadDB();
    const amount = Number(count) || 1;
    for (let i = 0; i < amount; i++) {
        db.keys.unshift({
            code: 'AK_' + Math.random().toString(36).substring(2, 6).toUpperCase() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase(),
            vipName,
            duration,
            isUsed: false,
            usedBy: null,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
    }
    saveDB(db);
    res.json({ status: 'success', message: 'Đã tạo Key thành công!' });
});

// Cổng trang web
app.get('/admin', (req, res) => {
    const adminPath = fs.existsSync(path.join(__dirname, 'public', 'admin.html')) ? path.join(__dirname, 'public', 'admin.html') : path.join(__dirname, 'admin.html');
    res.sendFile(adminPath);
});

app.get('*', (req, res) => {
    const indexPath = fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public', 'index.html') : path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

app.listen(PORT, () => console.log(`PORTAL ANH KHOI running on port: ${PORT}`));
