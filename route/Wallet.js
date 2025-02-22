const Wallet = require('../controller/Wallet')
const express = require('express')
const router = express.Router()


router.get('/:id', Wallet.getWalletById)
router.put('/:id', Wallet.updateWallet)
router.delete('/:id', Wallet.deleteWallet)

module.exports = router