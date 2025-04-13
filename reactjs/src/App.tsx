import "./assets/scss/reset.scss";
import "./assets/scss/base.scss";
import "./utils/string.util";
// Fonts
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { RouterProvider } from "react-router";
import router from "./configs/routes.config";
import { createTheme, ThemeProvider } from "@mui/material";
import { viVN } from "@mui/x-date-pickers/locales";

const theme = createTheme(
    {
        typography: {
            fontFamily: "Arial",
            fontSize: 20,
        },
    },
    viVN
);

function App() {
    return (
        <ThemeProvider theme={theme}>
            <RouterProvider router={router} />;
        </ThemeProvider>
    );
}

export default App;
