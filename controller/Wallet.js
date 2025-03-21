const Wallet = require("../model/Wallet");
const User = require("../model/User");

exports.updateWallet = async (req, res) => {
    try {
        const { balance } = req.body;
        const wallet = await Wallet.findOneAndUpdate(
            { user: req.params.id }, 
            { balance },
            { new: true }
        );

        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' });
        }

        res.status(200).json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getWalletById = async (req, res) => {
    try {
        const wallet = await Wallet.findById(req.params.id).populate('user');
        if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
        res.json(wallet);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



exports.deleteWallet = async (req, res) => {
    try {
        const wallet = await Wallet.findByIdAndDelete(req.params.id);
        if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
        res.json({ message: 'Wallet deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
