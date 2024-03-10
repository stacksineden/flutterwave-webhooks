const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const sdk = require("node-appwrite");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const client = new sdk.Client();

client
  .setEndpoint(process.env.APPWRITE_URL)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_KEY_SECRET);

const database = new sdk.Databases(client);

async function handleFlutterwaveWebhook(payload) {
  // console.log(payload, "from flutterwave");
  const userEmail = payload?.data?.customer?.email;

  console.log(payload, "payload from webhook");
  // console.log(userId, "userid format");

  if (!userEmail) {
    console.error("User ID not found in the payload");
    return;
  }

  // console.log(userEmail,'email')
  const query = sdk.Query.equal("user_email", userEmail);

  const userSubcriptionCollectionId =
    process.env.APPWRITE_USER_SUBCRIPTION_COLLECTION_DETAILS;
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  //retrive user subscription details
  const userSubscriptionDetails = await database.listDocuments(
    databaseId,
    userSubcriptionCollectionId,
    [query]
  );

  // console.log(userSubscriptionDetails?.documents[0], "user sub details");

  const documentId = userSubscriptionDetails?.documents[0]["$id"];
  // console.log(documentId, "id document");

  try {
    if (
      payload?.event === "charge.completed" &&
      payload?.data?.status === "successful"
    ) {
      await database.updateDocument(
        databaseId,
        userSubcriptionCollectionId,
        documentId,
        {
          is_subscribed: true,
          amount: payload?.data?.amount,
          tx_ref: payload?.data?.tx_ref,
          subscription_start_date: payload?.data?.createdAt,
        }
      );
    } else if (
      payload?.event === "charge.completed" &&
      payload?.data?.status === "failed"
    ) {
      await database.updateDocument(
        databaseId,
        userSubcriptionCollectionId,
        documentId,
        {
          is_subscribed: false,
        }
      );
    } else if (
      payload?.event === "subscription.cancelled" &&
      payload?.data?.status === "deactivated"
    ) {
      await database.updateDocument(
        databaseId,
        userSubcriptionCollectionId,
        documentId,
        {
          is_subscribed: false,
        }
      );
    }

    console.log("User subscription status updated successfully in Appwrite");
  } catch (error) {
    console.error(
      "Error updating user subscription status in Appwrite:",
      error
    );
  }
  console.log("card charge processed succesfully");
  return payload;
}

app.get("/", async function (req, res) {
  res.send("Einsteinai flutterwave webhook handler");
});

app.post("/flw-webhook", (req, res) => {
  const secretHash = process.env.FLW_SECRET_HASH;
  const signature = req.headers["verif-hash"];
  if (!signature || signature !== secretHash) {
    res.status(401).end();
  }
  const payload = req.body;
  // console.log(payload, "original from flutterwave");
  handleFlutterwaveWebhook(payload);
  res.status(200).end();
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// solidity5@Cardiology5
