import express from "express";
import { registerRoutes } from "./routes";

const app = express();
const PORT= process.env.PORT || 5000;

app.use(express.json());
app.use(express.static("client/dist"));
registerRoutes(app);

app.listen(PORT, () => {
    console.log('Serveur démarré sur le port', PORT);
});