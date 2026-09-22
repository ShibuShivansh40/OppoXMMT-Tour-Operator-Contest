const db = require('../config/db');

/**
 * Handle new winner consent submissions.
 * POST /api/winner-consent
 */
async function submitWinnerConsent(req, res) {
  try {
    const {
      name,
      phone,
      address,
      pincode,
      city,
      state,
      instagram_handle,
      facebook_handle,
      consent_winner_announcement,
      consent_social_feature,
      consent_tag_handles
    } = req.body;

    // Field validation checks
    if (!name || !phone || !address || !pincode || !city || !state || !instagram_handle) {
      return res.status(400).json({
        success: false,
        message: 'All fields (Name, Phone Number, Address, Pincode, City, State, Instagram Handle) are required.'
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit mobile phone number.'
      });
    }

    const cleanPincode = String(pincode).trim();
    if (!/^\d{6}$/.test(cleanPincode)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit postal pincode.'
      });
    }

    // Consent validation checks
    const hasAnnouncementConsent = consent_winner_announcement === true || consent_winner_announcement === 'true';
    const hasSocialFeatureConsent = consent_social_feature === true || consent_social_feature === 'true';
    const hasTagConsent = consent_tag_handles === true || consent_tag_handles === 'true';

    if (!hasAnnouncementConsent || !hasSocialFeatureConsent || !hasTagConsent) {
      return res.status(400).json({
        success: false,
        message: 'All 3 consent checkboxes must be agreed to in order to verify your contest prize.'
      });
    }

    // Clean Instagram Handle (ensure leading @ if not already present)
    let cleanInsta = String(instagram_handle).trim();
    if (!cleanInsta.startsWith('@')) {
      cleanInsta = '@' + cleanInsta;
    }

    // Clean Facebook Handle (optional)
    let cleanFb = '';
    if (facebook_handle) {
      cleanFb = String(facebook_handle).trim();
      if (cleanFb && !cleanFb.startsWith('@') && !cleanFb.startsWith('http://') && !cleanFb.startsWith('https://')) {
        cleanFb = '@' + cleanFb;
      }
    }

    // Metadata capture for verification
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // Save in database
    const savedRecord = await db.insertWinnerConsent({
      name: String(name).trim(),
      phone: cleanPhone,
      address: String(address).trim(),
      pincode: cleanPincode,
      city: String(city).trim(),
      state: String(state).trim(),
      instagram_handle: cleanInsta,
      facebook_handle: cleanFb,
      consent_winner_announcement: true,
      consent_social_feature: true,
      consent_tag_handles: true,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    return res.status(201).json({
      success: true,
      message: 'Winner verification and consent successfully recorded. Our team will get in touch regarding your prize dispatch!',
      data: savedRecord
    });
  } catch (error) {
    console.error('[Winner Consent Controller] Error saving consent:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to record winner consent. Please try again.',
      error: error.message
    });
  }
}

/**
 * Retrieve all recorded winner consents (Admin / Dashboard use).
 * GET /api/winner-consent
 */
async function getWinnerConsents(req, res) {
  try {
    const records = await db.getWinnerConsents();
    return res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error('[Winner Consent Controller] Error fetching consents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve winner consents.',
      error: error.message
    });
  }
}

module.exports = {
  submitWinnerConsent,
  getWinnerConsents
};
