const locations = require('../config/locations.json');
const operators = require('../config/operators.json');
const devices = require('../config/devices.json');

/**
 * GET /api/metadata/locations
 */
function getLocations(req, res) {
  return res.status(200).json({
    success: true,
    data: locations
  });
}

/**
 * GET /api/metadata/operators
 */
function getOperators(req, res) {
  return res.status(200).json({
    success: true,
    data: operators
  });
}

/**
 * GET /api/metadata/devices
 */
function getDevices(req, res) {
  return res.status(200).json({
    success: true,
    data: devices
  });
}

module.exports = {
  getLocations,
  getOperators,
  getDevices
};
