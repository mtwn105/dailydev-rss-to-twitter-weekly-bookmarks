const cron = require("node-cron");
const { User } = require("./schemas");
const { ETwitterStreamEvent, TwitterApi } = require("twitter-api-v2");
let Parser = require("rss-parser");
let parser = new Parser();
cron.schedule(
  "* * * * *",
  async () => {
    console.log("Bookmark Tweet Send Job Started");

    try {
      // Get today's day of the week like Monday Tuesday, etc.
      const day = new Date().toLocaleString("en-US", {
        weekday: "long",
      });

      const today = new Date();
      // const day = today.getDay();

      // Get time in hours and minutes
      const hours = today.getHours();
      const minutes = today.getMinutes();

      console.log({ day, hours, minutes });

      // Get all users
      const users = await User.find({
        rss_day: day,
        "rss_time.hour": hours,
        "rss_time.minute": minutes,
        rss_link: { $ne: null },
        twitter_access_token: { $ne: null },
        twitter_access_secret: { $ne: null },
      });

      console.log("Found users: ", users.length);

      for (let user of users) {
        try {
          console.log("Fetching bookmarks for user " + user.username);

          let feed = await parser.parseURL(user.rss_link);
          console.log("Total Bookmark Items: ", feed.items.length);

          const bookmarks = [];

          for (let item of feed.items) {
            let bookmark = {
              title: item.title,
              link: item.link,
              date: item.isoDate,
            };

            bookmarks.push(bookmark);
          }

          // Filter bookmarks from only past 7 days
          let filteredBookmarks = bookmarks.filter((bookmark) => {
            const date = new Date(bookmark.date);
            const diff = Math.abs(today - date);
            const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
          });

          console.log("Filtered Bookmark Items: ", filteredBookmarks.length);

          if (filteredBookmarks.length > 0) {
            // Latest 5
            if (filteredBookmarks.length > 5) {
              filteredBookmarks = filteredBookmarks.slice(0, 5);
            }

            console.log("Posting tweet for user " + user.username);
            // Post Tweet
            const tweet = await postBookmarkTweet(user, filteredBookmarks);
            console.log("Posted tweet for user " + user.username);
          }
        } catch (err) {
          console.error("Error while sending tweets for user - ", user.user_id);
          console.error(err);
        }
      }
    } catch (err) {
      console.log("error while resetting quota", err);

      // Send Logs
      sendLogs(
        {
          Event: "User Quota Reset",
          Status: "Error",
          User: user,
        },
        "twyttler_user_quota_reset"
      );
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Kolkata",
  }
);

postBookmarkTweet = async (user, bookmarks) => {
  const client = new TwitterApi({
    appKey: process.env.APP_KEY,
    appSecret: process.env.APP_SECRET,
    accessToken: user.twitter_access_token,
    accessSecret: user.twitter_access_secret,
  });

  await client.readWrite.v2.tweet(`

  Hey Peeps!

  Here are my favourite articles from last week:
  ${bookmarks.map((bookmark) => `👉 ${bookmark.link}`).join("\n")}

  Show your love 🥰 if you like it!

  `);
};
