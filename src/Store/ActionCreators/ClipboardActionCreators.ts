import {
  ReadFromClipboardFailure, ReadFromClipboardRequest, ReadFromClipboardSuccess,
  WriteToClipboardFailure, WriteToClipboardRequest, WriteToClipboardSuccess
} from "../../Typings/Store/clipboard";

export const writeToClipboardRequest = (text: string): WriteToClipboardRequest => ({
  type: 'WRITE_TO_CLIPBOARD',
  status: 'REQUEST',
  text
});

export const writeToClipboardSuccess = (text: string): WriteToClipboardSuccess => ({
  type: 'WRITE_TO_CLIPBOARD',
  status: 'SUCCESS',
  text
});

export const writeToClipboardFailure = (message: string): WriteToClipboardFailure => ({
  type: 'WRITE_TO_CLIPBOARD',
  status: 'FAILURE',
  message
});

export const readFromClipboardRequest = (): ReadFromClipboardRequest => ({
  type: 'READ_FROM_CLIPBOARD',
  status: 'REQUEST'
});

export const readFromClipboardSuccess = (text: string): ReadFromClipboardSuccess => ({
  type: 'READ_FROM_CLIPBOARD',
  status: 'SUCCESS',
  text
});

export const readFromClipboardFailure = (message: string): ReadFromClipboardFailure => ({
  type: 'READ_FROM_CLIPBOARD',
  status: 'FAILURE',
  message
});
