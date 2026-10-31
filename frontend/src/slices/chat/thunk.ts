import { createAsyncThunk } from "@reduxjs/toolkit";

import { chatMessage, messages } from "../../common/data/chat";

const cloneDemoValue = <Value>(value: Value): Value => JSON.parse(JSON.stringify(value)) as Value;

export const getDirectContact = createAsyncThunk("chat/getDirectContact", async () =>
  cloneDemoValue(chatMessage),
);

export const getChannels = createAsyncThunk("chat/getChannels", async () =>
  cloneDemoValue(
    chatMessage.flatMap((group) => ("channelsList" in group ? group.channelsList : [])),
  ),
);

export const getMessages = createAsyncThunk("chat/getMessages", async (roomId: number) =>
  cloneDemoValue(messages.filter((message) => message.roomId === Number(roomId))),
);

export const addMessage = createAsyncThunk("chat/addMessage", async (message: unknown) =>
  cloneDemoValue(message),
);

export const deleteMessage = createAsyncThunk("chat/deleteMessage", async (messageId: number) =>
  cloneDemoValue(messageId),
);
