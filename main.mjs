/**
 * ESM wrapper for cisco-dime
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ciscoDime = require("./main.js");

export const getOneFile = ciscoDime.getOneFile;
export const getOneFileStream = ciscoDime.getOneFileStream;
export const getMultipleFiles = ciscoDime.getMultipleFiles;
export const selectLogFiles = ciscoDime.selectLogFiles;
export const selectLogFilesMulti = ciscoDime.selectLogFilesMulti;
export const listNodeServiceLogs = ciscoDime.listNodeServiceLogs;
export const getCookie = ciscoDime.getCookie;
export const setCookie = ciscoDime.setCookie;

export const DimeError = ciscoDime.DimeError;
export const DimeAuthError = ciscoDime.DimeAuthError;
export const DimeNotFoundError = ciscoDime.DimeNotFoundError;
export const DimeTimeoutError = ciscoDime.DimeTimeoutError;
export const DimeRateLimitError = ciscoDime.DimeRateLimitError;

export default ciscoDime;
