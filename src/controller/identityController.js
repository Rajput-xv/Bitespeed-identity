const Contact = require('../models/Contacts');

exports.identify = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Either email or phoneNumber is required' });
    }

    const query = {
      $and: [
        { deletedAt: null },
        {
          $or: [
            email ? { email } : null,
            phoneNumber ? { phoneNumber } : null
          ].filter(Boolean)
        }
      ]
    };

    const existingContacts = await Contact.find(query).sort({ createdAt: 1 });

    if (existingContacts.length === 0) {
      const newContact = new Contact({
        phoneNumber,
        email,
        linkPrecedence: 'primary'
      });
      await newContact.save();

      return res.json({
        contact: {
          primaryContatctId: newContact._id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: []
        }
      });
    }

    const primaryContacts = existingContacts.filter(c => c.linkPrecedence === 'primary');
    
    if (primaryContacts.length > 1) {
      const oldestPrimary = primaryContacts.reduce((oldest, current) => 
        current.createdAt < oldest.createdAt ? current : oldest
      );

      for (const contact of primaryContacts) {
        if (contact._id.toString() !== oldestPrimary._id.toString()) {
          contact.linkPrecedence = 'secondary';
          contact.linkedId = oldestPrimary._id;
          await contact.save();
        }
      }
    }

    const primaryContact = primaryContacts.length > 0 
      ? primaryContacts.reduce((oldest, current) => 
          current.createdAt < oldest.createdAt ? current : oldest
        )
      : existingContacts.find(c => c.linkPrecedence === 'primary');

    const primaryContactId = primaryContact ? primaryContact._id : existingContacts[0].linkedId;

    const exactMatch = existingContacts.find(c => 
      c.email === email && c.phoneNumber === phoneNumber
    );

    if (!exactMatch) {
      const hasNewInfo = !existingContacts.some(c => 
        (email && c.email === email) && (phoneNumber && c.phoneNumber === phoneNumber)
      );

      if (hasNewInfo) {
        const newContact = new Contact({
          phoneNumber,
          email,
          linkedId: primaryContactId,
          linkPrecedence: 'secondary'
        });
        await newContact.save();
      }
    }

    const allRelatedContacts = await Contact.find({
      $and: [
        { deletedAt: null },
        {
          $or: [
            { _id: primaryContactId },
            { linkedId: primaryContactId }
          ]
        }
      ]
    }).sort({ createdAt: 1 });

    const primary = allRelatedContacts.find(c => c.linkPrecedence === 'primary');
    const secondaries = allRelatedContacts.filter(c => c.linkPrecedence === 'secondary');

    const emails = [...new Set([
      primary?.email,
      ...secondaries.map(c => c.email)
    ].filter(Boolean))];

    const phoneNumbers = [...new Set([
      primary?.phoneNumber,
      ...secondaries.map(c => c.phoneNumber)
    ].filter(Boolean))];

    res.json({
      contact: {
        primaryContatctId: primary._id,
        emails,
        phoneNumbers,
        secondaryContactIds: secondaries.map(c => c._id)
      }
    });

  } catch (error) {
    console.error('Error in identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};