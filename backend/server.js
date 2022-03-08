const oauth = require("oauth");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
let Parser = require("rss-parser");
require("./scheduler");

const { ETwitterStreamEvent, TwitterApi } = require("twitter-api-v2");

const { User } = require("./schemas");

const connectDB = require("./db");

require("dotenv").config();

connectDB();

const app = express();

app.use(express.json());

// app.use(helmet.crossOriginOpenerPolicy({ policy: "same-origin-allow-popups" }));
// // app.use(helmet.crossOriginResourcePolicy());
// app.use(helmet.noSniff());
// app.use(helmet.originAgentCluster());
app.use(helmet.ieNoOpen());
// app.use(
//   helmet.frameguard({
//     action: "sameorigin",
//   })
// );
app.use(helmet.hidePoweredBy());
app.use(helmet.xssFilter());

app.use(cors());

app.use(cookieParser());
app.use(session({ secret: process.env.COOKIE_SECRET || "secret" }));

app.use(morgan("combined"));

let parser = new Parser();

const oauthConsumer = new oauth.OAuth(
  "https://twitter.com/oauth/request_token",
  "https://twitter.com/oauth/access_token",
  process.env.APP_KEY,
  process.env.APP_SECRET,
  "1.0A",
  "http://127.0.0.1:3003/twitter/callback",
  "HMAC-SHA1"
);

const oa1Client = new TwitterApi({
  appKey: process.env.APP_KEY,
  appSecret: process.env.APP_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

jwtHandler = async (req, res, next) => {
  if (!req.headers["authorization"] || req.headers["authorization"] === "") {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized",
    });
  }

  // If type header is public then ignore jwt handling

  const token = req.headers["authorization"].substring(7);

  jwt.verify(token, process.env.TOKEN_SECRET, async (err, decoded) => {
    if (err) {
      console.error("Error occured verifying jwt: " + err);
      return res.status(401).send("Unauthorized");
    }

    const json = decoded;

    // Check if token expired
    if (json.exp < Date.now() / 1000) {
      console.error("Token expired");
      return res.status(401).json({
        status: "error",
        message: "Token Expired",
      });
    }

    const user = await User.findOne({ token: token });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    console.log(json);

    next();
  });
};

// Routes
app.get("/api/bookmarks", jwtHandler, async (req, res) => {
  const { url } = req.query;

  console.log("URL: " + url);

  if (!url || url == undefined || url == null) {
    return res.status(400).json({
      status: "error",
      message: "url is required",
    });
  }

  // Validate url http or https
  if (
    !url.match(
      /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/
    )
  ) {
    return res.status(400).json({
      status: "error",
      message: "url is invalid",
    });
  }

  try {
    let feed = await parser.parseURL(url);
    console.log("Bookmark Items: ", feed.items.length);

    const bookmarks = [];

    feed.items.forEach((item) => {
      let bookmark = {
        title: item.title,
        link: item.link,
        date: item.isoDate,
      };

      bookmarks.push(bookmark);
    });

    res.status(200).json({
      status: "success",
      data: bookmarks,
    });
  } catch (err) {
    console.error("Error while fetching bookmarks : ", err);
    res.status(500).json({
      status: "error",
      message: "Error while fetching bookmarks",
    });
  }
});

// Create User
app.post("/api/user", async (req, res) => {
  const { user_id, rss_link, twitter_access_token, twitter_refresh_token } =
    req.body;

  if (
    !user_id ||
    !rss_link ||
    !twitter_access_token ||
    !twitter_refresh_token
  ) {
    return res.status(400).json({
      status: "error",
      message: "All fields are required",
    });
  }

  const user = new User({
    user_id,
    rss_link,
    twitter_access_token,
    twitter_refresh_token,
  });

  try {
    await user.save();
    res.status(201).json({
      status: "success",
      data: user,
    });
  } catch (err) {
    console.error("Error occured creating user: " + err.message);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Get User
// app.get("/api/user", async (req, res) => {
//   const { user_id } = req.query;

//   if (!user_id) {
//     return res.status(400).json({
//       status: "error",
//       message: "user_id is required",
//     });
//   }

//   try {
//     const user = await User.findOne({ user_id });
//     res.status(200).json({
//       status: "success",
//       data: user,
//     });
//   } catch (err) {
//     console.error("Error occured getting user: " + err.message);
//     res.status(500).json({
//       status: "error",
//       message: err.message,
//     });
//   }
// });

// Get user using token
app.get("/api/user", jwtHandler, async (req, res) => {
  const token = req.headers["authorization"].substring(7);

  try {
    const user = await User.findOne({ token: token });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        user_id: user.user_id,
        name: user.name,
        username: user.username,
        rss_link: user.rss_link,
        rss_day: user.rss_day,
        rss_time: user.rss_time,
      },
    });
  } catch (err) {
    console.error("Error occured getting user: " + err.message);
    res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
});

// Twitter Authentication

app.get("/twitter/authenticate", twitter("authenticate"));
app.get("/twitter/authorize", twitter("authorize"));

function twitter(method = "authorize") {
  return async (req, res) => {
    console.log(`/twitter/${method}`);
    const { oauthRequestToken, oauthRequestTokenSecret } =
      await getOAuthRequestToken();

    console.log(`/twitter/${method} ->`, {
      oauthRequestToken,
      oauthRequestTokenSecret,
    });

    req.session = req.session || {};
    req.session.oauthRequestToken = oauthRequestToken;
    req.session.oauthRequestTokenSecret = oauthRequestTokenSecret;

    const authorizationUrl = `https://api.twitter.com/oauth/${method}?oauth_token=${oauthRequestToken}`;

    console.log("redirecting user to ", authorizationUrl);

    res.redirect(authorizationUrl);

    // res.status(200).json({ redirect: authorizationUrl });
  };
}

app.get("/twitter/callback", async (req, res) => {
  try {
    const { oauthRequestToken, oauthRequestTokenSecret } = req.session;
    const { oauth_verifier: oauthVerifier } = req.query;

    console.log("/twitter/callback", {
      oauthRequestToken,
      oauthRequestTokenSecret,
      oauthVerifier,
    });

    const { oauthAccessToken, oauthAccessTokenSecret, results } =
      await getOAuthAccessTokenWith({
        oauthRequestToken,
        oauthRequestTokenSecret,
        oauthVerifier,
      });
    req.session.oauthAccessToken = oauthAccessToken;

    const { user_id: userId /*, screen_name */ } = results;
    const user = await oauthGetUserById({
      oauthAccessToken,
      oauthAccessTokenSecret,
    });

    // Save or update the user
    const existingUser = await User.findOne({ user_id: userId });

    // Create token
    const token = jwt.sign(
      { userId, data: user.data },
      process.env.TOKEN_SECRET,
      {
        expiresIn: "2h",
      }
    );

    if (existingUser) {
      existingUser.twitter_access_token = oauthAccessToken;
      existingUser.twitter_access_secret = oauthAccessTokenSecret;
      // save user token
      existingUser.token = token;
      existingUser.lastLogin = new Date();
      existingUser.username = user.data.username;
      existingUser.name = user.data.name;
      await existingUser.save();
    } else {
      const newUser = new User({
        user_id: userId,
        username: user.data.username,
        name: user.data.name,
        twitter_access_token: oauthAccessToken,
        twitter_access_secret: oauthAccessTokenSecret,
        token,
      });

      await newUser.save();
    }

    console.log("user succesfully logged in with twitter", user.data);
    req.session.save(() => res.redirect("/?token=" + token));
  } catch (err) {
    console.error("Error occured during login: " + err.message);
    console.error(err);
    res.status(500).json({
      status: "error",
      message: "Error occured during login",
    });
  }
});

async function oauthGetUserById({ oauthAccessToken, oauthAccessTokenSecret }) {
  const client = new TwitterApi({
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    accessToken: oauthAccessToken,
    accessSecret: oauthAccessTokenSecret,
  });

  return await client.readWrite.v2.me();
}
async function getOAuthAccessTokenWith({
  oauthRequestToken,
  oauthRequestTokenSecret,
  oauthVerifier,
} = {}) {
  return new Promise((resolve, reject) => {
    oauthConsumer.getOAuthAccessToken(
      oauthRequestToken,
      oauthRequestTokenSecret,
      oauthVerifier,
      function (error, oauthAccessToken, oauthAccessTokenSecret, results) {
        return error
          ? reject(new Error("Error getting OAuth access token"))
          : resolve({ oauthAccessToken, oauthAccessTokenSecret, results });
      }
    );
  });
}
async function getOAuthRequestToken() {
  return new Promise((resolve, reject) => {
    oauthConsumer.getOAuthRequestToken(function (
      error,
      oauthRequestToken,
      oauthRequestTokenSecret,
      results
    ) {
      return error
        ? reject(new Error("Error getting OAuth request token"))
        : resolve({ oauthRequestToken, oauthRequestTokenSecret, results });
    });
  });
}

// Update RSS details for the logged in user
app.put("/api/user/rss", jwtHandler, async (req, res) => {
  const { url, day, time } = req.body;

  const token = req.headers["authorization"].substring(7);

  try {
    const user = await User.findOne({ token: token });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }
    user.rss_link = url;
    user.rss_day = day;
    user.rss_time = time;

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "RSS details updated",
    });
  } catch (err) {
    console.error("Error occured updating RSS link: ", err);
    return res.status(500).json({
      status: "error",
      message: "Error occured updating RSS link",
    });
  }
});

// Post Tweet
app.get("/api/tweet", async (req, res) => {
  // Get Oauth secret and user
  const { twitter_user_id, twitter_access_token, twitter_access_secret } =
    req.cookies;

  // Get User
  const user = await User.findOne({ user_id: twitter_user_id });

  // Validate token and secret with in db
  if (user.twitter_access_token !== twitter_access_token) {
    return res.status(400).json({
      status: "error",
      message: "Invalid access token",
    });
  }

  if (user.twitter_access_secret !== twitter_access_secret) {
    return res.status(400).json({
      status: "error",
      message: "Invalid access secret",
    });
  }

  // Get feed using RSS Link

  let feed = await parser.parseURL(url);
  console.log("Bookmark Items: ", feed.items.length);

  const bookmarks = [];

  for (let item of feed.items) {
    let bookmark = {
      title: item.title,
      link: item.link,
      date: item.isoDate,
    };

    bookmarks.push(bookmark);
  }

  // Post Tweet
  const tweet = await postTweet(user, bookmarks);

  res.status(200).json({
    status: "success",
    message: "Tweet posted",
  });
});

postTweet = async (user, bookmarks) => {
  const client = new TwitterApi({
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    accessToken: user.twitter_access_token,
    accessSecret: user.twitter_access_secret,
  });

  await client.readWrite.v2.tweet(`

  My latest bookmark: ${bookmarks[0].title}

  `);
};

app.get("*.*", express.static("public/client", { maxAge: "1y" }));

// serve frontend paths
app.all("*", function (req, res) {
  res.status(200).sendFile(`/`, { root: "public/client" });
});

// Error Handler
notFound = (req, res, next) => {
  res.status(404);
  const error = new Error("Not Found - " + req.originalUrl);
  next(error);
};

errorHandler = (err, req, res) => {
  res.status(res.statusCode || 500);
  res.json({
    error: err.name,
    message: err.message,
  });
};

app.use(notFound);
app.use(errorHandler);

getCurrentUser = async () => {
  try {
    const user = await oa1Client.readWrite.v2.me();
    console.log("User: " + JSON.stringify(user));
    return user;
  } catch (err) {
    console.error(
      "Error occured getting current user: " + JSON.stringify(err) + err.message
    );
  }
};

app.listen(process.env.PORT || 3000, async function () {
  console.log("Devto RSS to Tweet bot is running");
  twyttler = await getCurrentUser();
});
