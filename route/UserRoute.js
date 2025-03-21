const express = require('express')
const router = express.Router()
const UserController = require('../controller/UserController')

const Auth = require('../controller/Auth')
router.post('/', UserController.createUser)
router.post('/login', UserController.login)
router.get('/', Auth.Auth, UserController.getUserData)
router.get('/:userId', UserController.getUserTransactionData)
router.get('/ai/:userId', UserController.getAIFinancialAnalysis)
module.exports = router