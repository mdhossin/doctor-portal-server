const express = require("express");
require("dotenv").config();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const admin = require("firebase-admin");
const fileUpload = require("express-fileupload");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const app = express();
const port = process.env.PORT || 5000;

// use : doctorsUser
// pass : sN3fBu2GCZa4xZWJ

// doctors-portal-firebase-adminsdk.json -- eta hocce download kora json file er name

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());

// eta dia client side thake je data gula pacci segulake json e parse korsi
app.use(express.json());

// eta client side thake body er moddhe je data pathacci sekhane thake file and text gulake alada kore dibe
app.use(fileUpload());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.p3m2s.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// console.log(uri);

// create verify token function for verify
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctorsProtal");
    const appointmentsCollection = database.collection("appointment");
    const usersCollection = database.collection("users");
    const doctorsCollection = database.collection("doctors");

    // create a document to insert on the database for store data useing post api
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      // console.log(users);
      const result = await appointmentsCollection.insertOne(appointment);
      // console.log(result);
      res.json(result);
    });

    // load the specific id data from database connent to payment components
    app.get("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await appointmentsCollection.findOne(query);
      res.json(result);
    });

    // load the appointment all data here useing get pai
    app.get("/appointments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      // console.log(date);
      const query = { email: email, date: date };
      const result = await appointmentsCollection.find(query).toArray();
      res.json(result);
    });

    // update appointmnets added
    app.put("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          payment: payment,
        },
      };
      const result = await appointmentsCollection.updateOne(filter, updateDoc);
      res.json(result);
    });

    // all doctors data load here useing get api n   
    app.get('/doctors', async (req, res) => {
      const result = await doctorsCollection.find({}).toArray()
      res.json(result)
    })

    // doctors collection useing post api gog  dd
    app.post("/doctors", async (req, res) => {
      const name = req.body.name;
      const email = req.body.email;
      const picture = req.files.image;
      const pictureData = picture.data;
      const encodedPicture = pictureData.toString("base64");
      const imageBuffer = Buffer.from(encodedPicture, "base64");
      const doctor = {
        name,
        email,
        image: imageBuffer,
      };
      const result = await doctorsCollection.insertOne(doctor)
      res.json(result)
    });

    // get user detail set on the database using post api
    app.post("/users", async (req, res) => {
      const users = req.body;
      const result = await usersCollection.insertOne(users);
      res.json(result);
    });

    // get the specific user verified with email useing get api
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // update user useing put api upsert method use kore er kaj hocce user na thakle database e add korbe ar user thakle add korbe na
    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log("put", user);
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // update admin email on the database
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });

    // STRIPE PAYMENT API
    app.post("/create-payment-intent", async (req, res) => {
      const paymentInfo = req.body;
      const amount = paymentInfo.price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
    //   await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctors portal node server  call");
});

app.listen(port, () => {
  console.log("listening to port ", port);
});
