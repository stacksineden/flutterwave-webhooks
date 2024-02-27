const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const sdk = require('node-appwrite');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const client = new sdk.Client();

client
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('<YOUR_PROJECT_ID>')
  .setKey('<YOUR_API_KEY>');

const database = new sdk.Databases(client);

async function handleFlutterwaveWebhook(payload) {
  console.log(payload, 'from flutterwave');
  const userId = payload?.customer?.user_id;

  if (!userId) {
    console.error('User ID not found in the payload');
    return payload;
  }

  const userSubcriptionCollectionId =
    process.env.APPWRITE_USER_SUBCRIPTION_COLLECTION_DETAILS;

  try {
    if (
      payload?.event === 'charge.completed' &&
      payload?.data?.status === 'successful'
    ) {
      await database.updateDocument(userSubcriptionCollectionId, userId, {
        is_subscribed: true,
        amount: payload?.amount,
      });
    } else if (
      payload?.event === 'charge.completed' &&
      payload?.data?.status === 'failed'
    ) {
      await database.updateDocument(userSubcriptionCollectionId, userId, {
        is_subscribed: false,
      });
    } else if (
      payload?.event === 'subscription.cancelled' &&
      payload?.data?.status === 'deactivated'
    ) {
      await database.updateDocument(userSubcriptionCollectionId, userId, {
        is_subscribed: false,
      });
    }

    console.log('User subscription status updated successfully in Appwrite');
  } catch (error) {
    console.error(
      'Error updating user subscription status in Appwrite:',
      error
    );
  }
  return payload;
}

app.get('/', async function (req, res) {
  res.send('This is Einsteinai flutterwave webhook handler');
});

app.post('/flw-webhook', (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers['verif-hash'];
  if (!signature || signature !== secretHash) {
    res.status(401).end();
  }
  const payload = req.body;
  console.log(payload);
  handleFlutterwaveWebhook(payload);
  res.status(200).end();
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
