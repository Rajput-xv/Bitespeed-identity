const express = require('express');
const router = express.Router();
const identityController = require('../controller/identityController');

router.post('/identify', identityController.identify);

module.exports = router;