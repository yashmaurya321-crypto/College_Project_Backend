const jwt = require('jsonwebtoken');

const Auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization; 
        console.log('authHeader:', authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: "Please log in to access" });
        }

        const token = authHeader.split(' ')[1];
        console.log('token:', token);

        if (!token) {
            return res.status(401).json({ message: "Please log in to access" });
        }

        const decodedData = jwt.verify(token, 'yash');
        console.log('decodedData:', decodedData);

        req.user = { id: decodedData.id };
        next();
    } catch (error) {
        console.log('error:', error);
        return res.status(403).json({ message: "Forbidden" });
    }
};

const generateToken = (id, email) => {
    return jwt.sign({ id, email }, 'yash', { expiresIn: '1d' });
};

module.exports = { Auth, generateToken };
