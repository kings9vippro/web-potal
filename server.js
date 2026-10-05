const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Thêm mã hóa bảo mật

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'AnhKhoi2026';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static(path.join(__dirname, 'public')));
}
app.use(express.static(__dirname));

// Khởi tạo Database
function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = { users: [], deposits: [], keys: [] };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
        return initial;
    }
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } 
    catch (e) { return { users: [], deposits: [], keys: [] }; }
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// Tạo Token bảo mật 256-bit
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware xác thực người dùng
function authenticate(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ status: 'error', message: 'Vui lòng đăng nhập!' });
    
    const db = loadDB();
    const user = db.users.find(u => u.token === token);
    if (!user) return res.status(401).json({ status: 'error', message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ!' });
    
    req.user = user;
    req.db = db;
    next();
}

// 1. Đăng ký (Bảo mật Regex Email)
app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName, email } = req.body;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!username || !password || !email) return res.status(400).json({ status: 'error', message: 'Vui lòng điền đủ thông tin!' });
    if (!emailRegex.test(email)) return res.status(400).json({ status: 'error', message: 'Định dạng Email không hợp lệ!' });
    if (password.length < 6) return res.status(400).json({ status: 'error', message: 'Mật khẩu phải từ 6 ký tự!' });

    const db = loadDB();
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ status: 'error', message: 'Tên đăng nhập hoặc Email đã tồn tại!' });
    }

    const token = generateToken();
    const newUser = {
        id: 'AK_' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        username,
        password, // Thực tế nên dùng bcrypt, nhưng ở JSON DB ta giữ đơn giản
        displayName: displayName || username,
        email,
        balance: 0,
        vipLevel: 'Chưa Đăng Ký',
        vipExpiresAt: null, // Timestamp hết hạn
        avatar: '',
        token: token,
        createdAt: Date.now()
    };

    db.users.unshift(newUser);
    saveDB(db);
    
    const { password: _, ...safeUser } = newUser;
    return res.json({ status: 'success', message: 'Đăng ký thành công!', user: safeUser, token });
});

// 2. Đăng nhập
app.post('/api/auth/login', (req, res) => {
    const { loginId, password } = req.body;
    const db = loadDB();
    const user = db.users.find(u => (u.username.toLowerCase() === loginId.toLowerCase() || u.email.toLowerCase() === loginId.toLowerCase()) && u.password === password);
    
    if (!user) return res.status(401).json({ status: 'error', message: 'Sai tài khoản hoặc mật khẩu!' });

    user.token = generateToken(); // Reset token mỗi lần login
    saveDB(db);
    
    const { password: _, ...safeUser } = user;
    return res.json({ status: 'success', message: 'Đăng nhập thành công!', user: safeUser, token: user.token });
});

// 3. Kích hoạt KEY VIP (Tính giờ thực)
app.post('/api/key/redeem', authenticate, (req, res) => {
    const { keyCode } = req.body;
    const user = req.user;
    const db = req.db;

    const key = db.keys.find(k => k.code === keyCode.trim().toUpperCase() && !k.isUsed);
    if (!key) return res.status(400).json({ status: 'error', message: 'Mã Key không tồn tại hoặc đã được sử dụng!' });

    // Tính thời gian
    const now = Date.now();
    let durationMs = 0;
    if (key.duration.includes('Ngày')) durationMs = parseInt(key.duration) * 24 * 60 * 60 * 1000;
    else if (key.duration.includes('Giờ')) durationMs = parseInt(key.duration) * 60 * 60 * 1000;
    
    key.isUsed = true;
    key.usedBy = user.username;
    key.usedAt = now;

    user.vipLevel = key.vipName;
    if (key.duration === 'Vô Hạn') {
        user.vipExpiresAt = 'FOREVER';
    } else {
        user.vipExpiresAt = (user.vipExpiresAt && user.vipExpiresAt !== 'FOREVER' && user.vipExpiresAt > now) 
            ? user.vipExpiresAt + durationMs 
            : now + durationMs;
    }

    saveDB(db);
    const { password: _, ...safeUser } = user;
    return res.json({ status: 'success', message: `Đã kích hoạt ${key.vipName} thành công!`, user: safeUser });
});

// 4. Update thông tin (Có xác thực)
app.post('/api/user/update', authenticate, (req, res) => {
    const { displayName, avatar, oldPassword, newPassword } = req.body;
    const user = req.user;
    const db = req.db;

    if (displayName) user.displayName = displayName;
    if (avatar !== undefined) user.avatar = avatar;

    if (newPassword) {
        if (user.password !== oldPassword) return res.status(400).json({ status: 'error', message: 'Mật khẩu hiện tại sai!' });
        user.password = newPassword;
    }

    saveDB(db);
    const { password: _, ...safeUser } = user;
    return res.json({ status: 'success', message: 'Cập nhật tài khoản thành công!', user: safeUser });
});

// 5. Kiểm tra quyền truy cập Tool
app.post('/api/tool/access', authenticate, (req, res) => {
    const user = req.user;
    if (!user.vipExpiresAt || (user.vipExpiresAt !== 'FOREVER' && Date.now() > user.vipExpiresAt)) {
        return res.status(403).json({ status: 'error', message: 'Gói VIP của bạn đã hết hạn. Vui lòng nạp Key mới để tiếp tục!' });
    }
    return res.json({ status: 'success', message: 'Truy cập thuật toán thành công!' });
});

// ================= ADMIN SERVER =================
function authAdmin(req, res, next) {
    const key = req.headers['x-admin-key'];
    if (key !== ADMIN_SECRET) return res.status(403).json({ status: 'error', message: 'Từ chối quyền truy cập!' });
    next();
}

app.get('/api/admin/overview', authAdmin, (req, res) => {
    const db = loadDB();
    res.json({ status: 'success', users: db.users, keys: db.keys });
});

app.post('/api/admin/keys/create', authAdmin, (req, res) => {
    const { vipName, duration, count } = req.body;
    const db = loadDB();
    for (let i = 0; i < (count || 1); i++) {
        db.keys.unshift({
            code: 'AK_' + crypto.randomBytes(3).toString('hex').toUpperCase() + '_' + crypto.randomBytes(3).toString('hex').toUpperCase(),
            vipName, duration, isUsed: false, usedBy: null, createdAt: Date.now()
        });
    }
    saveDB(db);
    res.json({ status: 'success', message: `Đã tạo Key thành công!` });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Máy chủ NOEL PORTAL chạy tại cổng: ${PORT}`));
