/**
 * ESM wrapper for cisco-dime
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ciscoDime = require("./main.js");

export const getOneFile = ciscoDime.getOneFile;
export const selectLogFiles = ciscoDime.selectLogFiles;
export const listNodeServiceLogs = ciscoDime.listNodeServiceLogs;
export const getCookie = ciscoDime.getCookie;
export const setCookie = ciscoDime.setCookie;

export default ciscoDime;
