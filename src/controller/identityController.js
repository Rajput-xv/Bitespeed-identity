const Contact = require('../models/Contacts');

exports.identify = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Either email or phoneNumber is required' });
    }

    const matchingContacts = await Contact.find({
      deletedAt: null,
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ]
    }).sort({ createdAt: 1 });

    if (matchingContacts.length === 0) {
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

    const allPrimaryIds = new Set();
    const allContactIds = new Set();

    matchingContacts.forEach(contact => {
      allContactIds.add(contact._id.toString());
      if (contact.linkPrecedence === 'primary') {
        allPrimaryIds.add(contact._id.toString());
      } else if (contact.linkedId) {
        allPrimaryIds.add(contact.linkedId.toString());
      }
    });

    const allRelatedContacts = await Contact.find({
      deletedAt: null,
      $or: [
        { _id: { $in: Array.from(allPrimaryIds) } },
        { linkedId: { $in: Array.from(allPrimaryIds) } }
      ]
    }).sort({ createdAt: 1 });

    const primaryContacts = allRelatedContacts.filter(c => c.linkPrecedence === 'primary');
    const oldestPrimary = primaryContacts.reduce((oldest, current) => 
      current.createdAt < oldest.createdAt ? current : oldest
    );

    if (primaryContacts.length > 1) {
      for (const contact of primaryContacts) {
        if (contact._id.toString() !== oldestPrimary._id.toString()) {
          contact.linkPrecedence = 'secondary';
          contact.linkedId = oldestPrimary._id;
          await contact.save();
        }
      }
    }

    const exactMatch = allRelatedContacts.find(c => 
      c.email === email && c.phoneNumber === phoneNumber
    );

    if (!exactMatch) {
      const hasEmailMatch = email && allRelatedContacts.some(c => c.email === email);
      const hasPhoneMatch = phoneNumber && allRelatedContacts.some(c => c.phoneNumber === phoneNumber);
      const hasNewEmail = email && !allRelatedContacts.some(c => c.email === email);
      const hasNewPhone = phoneNumber && !allRelatedContacts.some(c => c.phoneNumber === phoneNumber);

      if ((hasEmailMatch || hasPhoneMatch) && (hasNewEmail || hasNewPhone)) {
        const newContact = new Contact({
          phoneNumber,
          email,
          linkedId: oldestPrimary._id,
          linkPrecedence: 'secondary'
        });
        await newContact.save();
      }
    }

    const finalRelatedContacts = await Contact.find({
      deletedAt: null,
      $or: [
        { _id: oldestPrimary._id },
        { linkedId: oldestPrimary._id }
      ]
    }).sort({ createdAt: 1 });

    const primary = finalRelatedContacts.find(c => c.linkPrecedence === 'primary');
    const secondaries = finalRelatedContacts.filter(c => c.linkPrecedence === 'secondary');

    const allEmails = [];
    const allPhoneNumbers = [];

    if (primary.email) allEmails.push(primary.email);
    if (primary.phoneNumber) allPhoneNumbers.push(primary.phoneNumber);

    secondaries.forEach(contact => {
      if (contact.email && !allEmails.includes(contact.email)) {
        allEmails.push(contact.email);
      }
      if (contact.phoneNumber && !allPhoneNumbers.includes(contact.phoneNumber)) {
        allPhoneNumbers.push(contact.phoneNumber);
      }
    });

    res.json({
      contact: {
        primaryContatctId: primary._id,
        emails: allEmails,
        phoneNumbers: allPhoneNumbers,
        secondaryContactIds: secondaries.map(c => c._id)
      }
    });

  } catch (error) {
    console.error('Error in identify:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};