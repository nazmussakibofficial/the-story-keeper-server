const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yxjl2sj.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        const usersCollection = client.db('storyKeeper').collection('users');
        const productsCollection = client.db('storyKeeper').collection('products');
        const bookingsCollection = client.db('storyKeeper').collection('bookings');

        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        const verifySeller = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'seller') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }

        app.post('/users', async (req, res) => {
            const email = req.body.email;
            const userQuery = {};
            const alreadyRegistered = await usersCollection.find(userQuery).toArray();
            const alreadyRegisteredEmails = alreadyRegistered.map(reg => reg.email)
            if (!alreadyRegisteredEmails.includes(email)) {
                const user = req.body;
                const result = await usersCollection.insertOne(user);
                res.send(result);
            }

        })

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET)
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' })
        });

        app.get('/users', async (req, res) => {
            let query = {};
            if (req.query.role === "buyer") {
                query = { role: 'buyer' }
            }
            else if (req.query.role === "seller") {
                query = { role: 'seller' }
            }
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isAdmin: user?.role === 'admin' })
        })

        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await usersCollection.findOne(query);
            res.send({ isSeller: user?.role === 'seller' })
        })

        app.get('/userData', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            res.send(user);
        });

        // products

        app.post('/products', verifyJWT, verifySeller, async (req, res) => {
            const { name, image, category, location, resale, original, usedTime, condition, sellerName, sellerEmail } = req.body;
            const result = await productsCollection.insertOne({ name, image, category, location, resale, original, usedTime, condition, sellerName, sellerEmail, date: new Date() });
            res.send(result);
        });

        app.get('/products', verifyJWT, verifySeller, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const query = { sellerEmail: email };
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        })

        app.patch('/products/:id', async (req, res) => {
            const id = req.params.id;
            const isAd = req.body.isAd;
            const query = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    isAd
                }
            }
            const result = await productsCollection.updateOne(query, updatedDoc);
            res.send(result);
        })

        app.delete('/products/:id', verifyJWT, verifySeller, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(filter);
            res.send(result);
        })

        app.get('/category/:id', async (req, res) => {
            const category = req.params.id;
            const query = { category: category };
            const products = await productsCollection.find(query).toArray();
            const bookingQuery = {}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            const bookedIds = alreadyBooked.map(book => book.productID);
            const remainingProducts = products.filter(product => !bookedIds.includes(ObjectId(product._id).toString()));
            res.send(remainingProducts);

        })

        app.get('/recentlyadded', async (req, res) => {
            const query = {};
            const products = await productsCollection.find(query).limit(3).sort({ "date": -1 }).toArray();
            res.send(products);
        })

        app.get('/advertisedProducts', async (req, res) => {
            const query = { isAd: true };
            const products = await productsCollection.find(query).limit(3).sort({ "date": -1 }).toArray();
            res.send(products);
        })


        //bookings

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            const query = { productID: booking.productID }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if (alreadyBooked.length) {
                const message = `${booking.productName} is already booked`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingsCollection.insertOne(booking);
            res.send(result);
        });



    }
    finally {

    }
}

run().catch(e => console.error(e));


app.get('/', async (req, res) => {
    res.send('the story keeper server is running');
})

app.listen(port, () => console.log(`the story keeper server running on ${port}`))