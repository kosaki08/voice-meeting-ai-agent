import path from "path";
import dotenv from "dotenv";

// テストが実行される前に .env.local を読み込み
dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});
