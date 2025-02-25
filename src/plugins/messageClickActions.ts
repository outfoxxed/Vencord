/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addClickListener, removeClickListener } from "@api/MessageEvents";
import { definePluginSettings, Settings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, PermissionStore, UserStore } from "@webpack/common";

let isDeletePressed = false;
const keydown = (e: KeyboardEvent) => e.key === "Backspace" && (isDeletePressed = true);
const keyup = (e: KeyboardEvent) => e.key === "Backspace" && (isDeletePressed = false);

const MANAGE_CHANNELS = 1n << 4n;

const settings = definePluginSettings({
    enableDeleteOnClick: {
        type: OptionType.BOOLEAN,
        description: "Enable delete on click",
        default: true
    },
    enableDoubleClickToEdit: {
        type: OptionType.BOOLEAN,
        description: "Enable double click to edit",
        default: true
    },
    enableDoubleClickToReply: {
        type: OptionType.BOOLEAN,
        description: "Enable double click to reply",
        default: true
    },
    requireModifier: {
        type: OptionType.BOOLEAN,
        description: "Only do double click actions when shift/ctrl is held",
        default: false
    }
});

export default definePlugin({
    name: "MessageClickActions",
    description: "Hold Backspace and click to delete, double click to edit/reply",
    authors: [Devs.Ven],
    dependencies: ["MessageEventsAPI"],

    settings,

    start() {
        const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage");
        const EditStore = findByPropsLazy("isEditing", "isEditingAny");

        document.addEventListener("keydown", keydown);
        document.addEventListener("keyup", keyup);

        this.onClick = addClickListener((msg, channel, event) => {
            const isMe = msg.author.id === UserStore.getCurrentUser().id;
            if (!isDeletePressed) {
                if (event.detail < 2) return;
                if (settings.store.requireModifier && !event.ctrlKey && !event.shiftKey) return;

                if (isMe) {
                    if (!settings.store.enableDoubleClickToEdit || EditStore.isEditing(channel.id, msg.id)) return;

                    MessageActions.startEditMessage(channel.id, msg.id, msg.content);
                    event.preventDefault();
                } else {
                    if (!settings.store.enableDoubleClickToReply) return;

                    FluxDispatcher.dispatch({
                        type: "CREATE_PENDING_REPLY",
                        channel,
                        message: msg,
                        shouldMention: !Settings.plugins.NoReplyMention.enabled,
                        showMentionToggle: channel.guild_id !== null
                    });
                }
            } else if (settings.store.enableDeleteOnClick && (isMe || PermissionStore.can(MANAGE_CHANNELS, channel))) {
                MessageActions.deleteMessage(channel.id, msg.id);
                event.preventDefault();
            }
        });
    },

    stop() {
        removeClickListener(this.onClick);
        document.removeEventListener("keydown", keydown);
        document.removeEventListener("keyup", keyup);
    }
});
