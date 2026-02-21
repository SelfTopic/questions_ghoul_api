import app from "./app";
const PORT = 3000; 
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
    console.log(`🚀 Сервер запущен на http://${HOST}:${PORT}`);
})  