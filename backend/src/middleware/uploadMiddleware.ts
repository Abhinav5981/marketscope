import multer from "multer";
import { MAX_UPLOAD_SIZE_BYTES } from "../config/constants";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx"];

/** Memory storage (no temp files on disk) — the portfolio file is small and parsed immediately, then discarded. */
export const uploadPortfolioFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => file.originalname.toLowerCase().endsWith(ext));
    if (!isAllowed) {
      callback(new Error(`Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.`));
      return;
    }
    callback(null, true);
  },
}).single("file");
