import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Videokisen from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Videokisen />
  </React.StrictMode>
);
