const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Mật mã bảo mật trang Quản trị (Admin Secret PIN)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'AnhKhoi2026';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo Database JSON tự động
function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                {
                    id: 'AK_001',
                    username: 'anhkhoi',
                    password: '123',
                    displayName: 'Phạm Anh Khôi',
                    email: 'dev.anhkhoi@gmail.com',
                    balance: 500000,
                    vipLevel: 'SIÊU VIP KIM CƯƠNG',
                    vipExpire: 'Vô Thời Hạn',
                    avatar: '',
                    provider: 'Hệ thống',
                    createdAt: '2026-10-01 10:00'
                }
            ],
            deposits: [],
            keys: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ==================== CỔNG CLIENT API ====================

// 1. Đăng ký tài khoản
app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ status: 'error', message: 'Vui lòng điền đủ thông tin!' });
    }

    const db = loadDB();
    const exists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        return res.status(400).json({ status: 'error', message: 'Tên đăng nhập hoặc Email đã tồn tại!' });
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
    return res.json({ status: 'success', message: 'Đăng ký tài khoản thành công!', user: newUser });
});

// 2. Đăng nhập chuẩn
app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    const db = loadDB();
    const user = db.users.find(u => (u.username.toLowerCase() === loginId.toLowerCase() || u.email.toLowerCase() === loginId.toLowerCase()) && u.password === password);

    if (!user) {
        return res.status(401).json({ status: 'error', message: 'Sai tên đăng nhập, email hoặc mật khẩu!' });
    }
    return res.json({ status: 'success', message: 'Đăng nhập thành công!', user });
});

// 3. Đăng nhập Social (Google / GitHub)
app.post('/api/auth/social', (req, res) => {
    const { provider, email, name, avatar } = req.body;
    const db = loadDB();
    let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        user = {
            id: 'AK_' + Date.now().toString().slice(-6),
            username: email.split('@')[0] + '_' + provider.toLowerCase(),
            password: 'OAuth_Password_' + Math.random().toString(36),
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

// 4. Đổi Avatar & Thông tin cá nhân
app.post('/api/user/update', (req, res) => {
    const { userId, displayName, avatar, oldPassword, newPassword } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Không tìm thấy tài khoản!' });

    if (displayName) user.displayName = displayName;
    if (avatar !== undefined) user.avatar = avatar;

    if (newPassword) {
        if (user.password !== oldPassword) {
            return res.status(400).json({ status: 'error', message: 'Mật khẩu hiện tại không chính xác!' });
        }
        user.password = newPassword;
    }

    saveDB(db);
    return res.json({ status: 'success', message: 'Cập nhật tài khoản thành công!', user });
});

// 5. Yêu cầu nạp tiền
app.post('/api/deposit/create', (req, res) => {
    const { userId, amount, bankCode } = req.body;
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

// 6. Nhập Key VIP kích hoạt
app.post('/api/key/redeem', (req, res) => {
    const { userId, keyCode } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Tài khoản không hợp lệ!' });

    const key = db.keys.find(k => k.code === keyCode.trim().toUpperCase() && !k.isUsed);
    if (!key) {
        return res.status(400).json({ status: 'error', message: 'Mã Key không tồn tại hoặc đã được sử dụng!' });
    }

    key.isUsed = true;
    key.usedBy = user.username;
    key.usedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    user.vipLevel = key.vipName;
    user.vipExpire = key.duration;

    saveDB(db);
    return res.json({ status: 'success', message: `Kích hoạt thành công gói ${key.vipName}!`, user });
});

// 7. Mua gói VIP trực tiếp bằng số dư
app.post('/api/vip/buy', (req, res) => {
    const { userId, packageName, price, duration } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'Tài khoản không hợp lệ!' });

    if (user.balance < price) {
        return res.status(400).json({ status: 'error', message: 'Số dư không đủ, vui lòng nạp thêm tiền!' });
    }

    user.balance -= price;
    user.vipLevel = packageName;
    user.vipExpire = duration;

    saveDB(db);
    return res.json({ status: 'success', message: `Nâng cấp thành công gói ${packageName}!`, user });
});

// ==================== CỔNG QUẢN TRỊ ADMIN (BẢO MẬT TUYỆT ĐỐI) ====================

// Middleware kiểm tra Secret PIN Admin
function authAdmin(req, res, next) {
    const token = req.headers['x-admin-key'] || req.query.admin_key;
    if (token !== ADMIN_SECRET) {
        return res.status(403).json({ status: 'error', message: 'Không có quyền truy cập cổng Quản Trị!' });
    }
    next();
}

// Lấy danh sách tất cả Accounts & Thống kê
app.get('/api/admin/overview', authAdmin, (req, res) => {
    const db = loadDB();
    res.json({
        status: 'success',
        users: db.users,
        deposits: db.deposits,
        keys: db.keys
    });
});

// Duyệt hoặc từ chối tiền nạp
app.post('/api/admin/deposit/action', authAdmin, (req, res) => {
    const { depositId, action } = req.body; // action: 'approve' | 'reject'
    const db = loadDB();
    const deposit = db.deposits.find(d => d.id === depositId);
    if (!deposit) return res.status(404).json({ status: 'error', message: 'Không tìm thấy hóa đơn nạp!' });

    if (deposit.status !== 'Chờ duyệt') {
        return res.status(400).json({ status: 'error', message: 'Giao dịch này đã được xử lý trước đó!' });
    }

    if (action === 'approve') {
        const user = db.users.find(u => u.id === deposit.userId);
        if (user) {
            user.balance += deposit.amount;
        }
        deposit.status = 'Đã cộng tiền';
    } else {
        deposit.status = 'Từ chối';
    }

    saveDB(db);
    res.json({ status: 'success', message: `Đã ${action === 'approve' ? 'DUYỆT và cộng tiền' : 'TỪ CHỐI'} hóa đơn ${deposit.id}!` });
});

// Tạo Mã Key VIP mới
app.post('/api/admin/keys/create', authAdmin, (req, res) => {
    const { vipName, duration, count } = req.body;
    const db = loadDB();
    const createdKeys = [];

    const amount = Number(count) || 1;
    for (let i = 0; i < amount; i++) {
        const code = 'AK_' + Math.random().toString(36).substring(2, 6).toUpperCase() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const newKey = {
            code,
            vipName,
            duration,
            isUsed: false,
            usedBy: null,
            createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        db.keys.unshift(newKey);
        createdKeys.push(newKey);
    }

    saveDB(db);
    res.json({ status: 'success', message: `Đã tạo ${createdKeys.length} mã Key thành công!`, keys: createdKeys });
});

// Định tuyến cổng vào trang Admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`[PORTAL ANH KHOI] May chu dang chay tai cong: ${PORT}`);
});
