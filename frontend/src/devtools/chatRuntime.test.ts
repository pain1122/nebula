import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it } from "vitest";

import chatReducer from "../slices/chat/reducer";
import {
  addMessage,
  deleteMessage,
  getDirectContact,
  getMessages,
} from "../slices/chat/thunk";

describe("retained chat demo runtime", () => {
  it("uses room-scoped local fixtures and keeps demo mutations local", async () => {
    const store = configureStore({ reducer: { Chat: chatReducer } });

    await store.dispatch(getDirectContact());
    expect(store.getState().Chat.chats[0].direactContact[0].name).toBe("Lisa Parker");

    await store.dispatch(getMessages(1));
    expect(store.getState().Chat.messages).toHaveLength(1);
    expect(store.getState().Chat.messages[0].roomId).toBe(1);

    const message = {
      id: 9001,
      from_id: 1,
      to_id: 2,
      msg: "Local toolbox message",
      reply: "",
      isImages: false,
      has_images: [],
      datetime: "10:00 am",
    };
    await store.dispatch(addMessage(message));
    expect(store.getState().Chat.messages[0].usermessages).toContainEqual(message);

    await store.dispatch(deleteMessage(message.id));
    expect(store.getState().Chat.messages[0].usermessages).not.toContainEqual(message);
  });
});
