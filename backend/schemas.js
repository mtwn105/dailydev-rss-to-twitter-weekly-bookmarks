const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Registered Users Schema
const user = new Schema({
  user_id: { type: String },
  name: { type: String },
  username: { type: String },
  rss_link: { type: String },
  rss_day: { type: String, default: "Monday" },
  rss_time: { type: Object, default: { hour: 12, minute: 0 } },
  twitter_access_token: { type: String },
  twitter_access_secret: { type: String },
  token: { type: String },
  lastLogin: { type: Date, default: Date.now },
});

const User = mongoose.model("User", user, "users");

module.exports = {
  User,
};
