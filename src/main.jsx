import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Videomat from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Videomat />
  </React.StrictMode>
);
