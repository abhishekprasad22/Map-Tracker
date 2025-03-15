import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3000;



const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,

  // connectionString: process.env.DB_URL,
  // ssl: { rejectUnauthorized: false }, // Required for cloud-hosted PostgreSQL
});
db.connect((err) => {
  if (err) {
    console.error("Failed to connect to the database:", err);
  } else {
    console.log("Connected to the database");
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];

// Returns the visited countries list that a user with the given user id have visited already.
async function checkVisisted() {
  const result = await db.query(
    "SELECT country_code FROM visited_countries JOIN users ON  users.id = user_id WHERE user_id = $1;",
    [currentUserId]
  );
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

// Returns the current user's id, name and color.
async function getCurrentUser() {
  const result = await db.query("SELECT * FROM users;");
  users = result.rows;

  if (users.length === 0) {
    return null;
  }
  return users.find((user) => user.id == currentUserId); 
  //Here we have used == instead of ===, because in === check data types as well as the value.
  // Whereas == only check the value only. Since its hard to determine the data type of user.id and currentUserId.
}


app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    res.render("index.ejs", {
      countries: [],
      total: 0,
      users: users,
      color: "black",
    });
  } else {
    
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
    });
  }
  
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const currentUser = await getCurrentUser();

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

// If user add a new member than the input with name="add" will be post and this will be handled by the below code.
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  }
  else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  //The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html

  //This code will handle the newly added family member
  //From the new.ejs when new name and color will be posted the this two variables is assigned to it.
  const name = req.body.name;
  const color = req.body.color;

  const result = await db.query(
    //RETURNING * in the below query will return the newly inserted single entry.
    "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
    [name, color]
  );

  const id = result.rows[0].id;
  currentUserId = id;

  res.redirect("/");
});

app.delete('/deleteUser/:id', async(req, res) => {
  const userId = req.params.id;
  try {

    //First user's visited countries will be deleted because of the foreign 
    // key of the visited_countries table.
    await db.query('DELETE FROM visited_countries WHERE user_id = $1', [userId]);


    // Then the user's data will be deleted from the users table
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    // After deleting the current user switch to the available user
    if (currentUserId == userId){
      const result = await db.query('SELECT id FROM users LIMIT 1');
      if (result.rows.length > 0){
        currentUserId = result.rows[0].id;
      }
    }

    res.json({ success: true});

  } catch (err) {
    console.error('Error deleting the user:', err);
    res.json({
      success: false,
      error: err.message
    });
    
  }
});


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
// export default app;