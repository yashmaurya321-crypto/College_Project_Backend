const express = require('express');
const Category = require('../model/Category');
const router = express.Router();
const Transaction = require('../controller/Transaction');

const Auth = require('../controller/Auth')

router.post('/', Auth.Auth, Transaction.createTransaction);
router.get('/:id',  Transaction.getTransactionByUserId);

  


module.exports = router;