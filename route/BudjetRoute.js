const express = require('express');
const router = express.Router();
const Budjet = require('../controller/Budjet');
const Auth = require('../controller/Auth')

router.post('/', Auth.Auth, Budjet.createBudjet);
router.put('/:userId', Budjet.updateOrCreateCategory);

module.exports = router;
