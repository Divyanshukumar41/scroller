import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  LogOut,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  Send,
  Smile,
  Sparkles,
  Video,
  WifiOff,
} from "lucide-react";

import api from "../services/api";
import { socket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

/* =========================================================
   HELPERS
========================================================= */

const avatar = (u) =>
  u?.profile_picture ||
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    u?.fullName || "User"
  )}&background=6366f1&color=fff&bold=true`;

const timeLabel = (date) => {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/*
  Handles:
  string
  ObjectId
  { _id }
  { user_id }
  { id }
*/
const idOf = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "object") {
    return String(
      value?._id ??
        value?.user_id ??
        value?.id ??
        ""
    );
  }

  return String(value);
};

export default function Chat() {
  const { user, logout } = useAuth();

  /* =======================================================
     STATE
  ======================================================= */

  const [users, setUsers] = useState([]);

  const [selected, setSelected] =
    useState(null);

  const [conversation, setConversation] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [text, setText] = useState("");

  const [query, setQuery] =
    useState("");

  const [typing, setTyping] =
    useState(false);

  const [online, setOnline] =
    useState({});

  const [mobile, setMobile] =
    useState(false);

  const [loadingUsers, setLoadingUsers] =
    useState(true);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [connected, setConnected] =
    useState(socket.connected);

  /* =======================================================
     REFS
  ======================================================= */

  const endRef = useRef(null);

  const typingTimer =
    useRef(null);

  const conversationRef =
    useRef(null);

  const selectedRef =
    useRef(null);

  const messagesRef =
    useRef([]);

  const openingConversationRef =
    useRef(0);

  /* =======================================================
     SYNC REFS
  ======================================================= */

  useEffect(() => {
    conversationRef.current =
      conversation;
  }, [conversation]);

  useEffect(() => {
    selectedRef.current =
      selected;
  }, [selected]);

  useEffect(() => {
    messagesRef.current =
      messages;
  }, [messages]);

  /* =======================================================
     CURRENT LOGGED-IN USER ID
  ======================================================= */

  const currentUserId = useMemo(() => {
    return idOf(user);
  }, [user]);

  /* =======================================================
     MESSAGE OWNER

     TRUE  -> current logged-in user -> RIGHT
     FALSE -> other user            -> LEFT
  ======================================================= */

  const isMine = useCallback(
    (message) => {
      if (
        !message ||
        !currentUserId
      ) {
        return false;
      }

      const senderId = idOf(
        message?.sender ??
          message?.senderId ??
          message?.sender_id ??
          message?.userId ??
          message?.user_id
      );

      return (
        senderId !== "" &&
        senderId === currentUserId
      );
    },
    [currentUserId]
  );

  /* =======================================================
     ONLINE
  ======================================================= */

  const isOnline = useCallback(
    (chatUser) => {
      return (
        online[idOf(chatUser)] ??
        chatUser?.status === "online"
      );
    },
    [online]
  );

  /* =======================================================
     FILTER USERS
  ======================================================= */

  const filteredUsers = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase();

    return users.filter((u) => {
      const sameUser =
        idOf(u) === currentUserId;

      const matches =
        !q ||
        u?.fullName
          ?.toLowerCase()
          .includes(q);

      return (
        !sameUser &&
        matches
      );
    });
  }, [
    users,
    query,
    currentUserId,
  ]);

  /* =======================================================
     LOAD USERS
  ======================================================= */

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      try {
        setLoadingUsers(true);

        const { data } =
          await api.get("/users");

        if (!active) return;

        const list =
          data?.users || [];

        setUsers(list);

        setOnline(
          Object.fromEntries(
            list.map((u) => [
              idOf(u),
              u?.status ===
                "online",
            ])
          )
        );
      } catch (error) {
        console.error(
          "Failed to load users:",
          error
        );
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    };

    loadUsers();

    return () => {
      active = false;
    };
  }, []);

  /* =======================================================
     SOCKET EVENTS
  ======================================================= */

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);

      /*
        Retry offline messages
      */
      const pending =
        messagesRef.current.filter(
          (message) =>
            message?.status ===
              "pending" &&
            message?._localId
        );

      pending.forEach((message) => {
        socket.emit(
          "message:send",
          {
            conversationId:
              idOf(
                message.conversation
              ),

            receiverId:
              idOf(
                message.receiver
              ),

            text: message.text,

            message_type:
              message.message_type ||
              "text",

            localId:
              message._localId,
          },
          (result) => {
            setMessages((prev) =>
              prev.map((item) => {
                if (
                  item?._localId !==
                  message._localId
                ) {
                  return item;
                }

                if (
                  !result?.success
                ) {
                  return {
                    ...item,
                    status:
                      "pending",
                  };
                }

                return {
                  ...item,
                  status:
                    "sending",
                };
              })
            );
          }
        );
      });
    };

    const onDisconnect = () => {
      setConnected(false);
      setSending(false);
      setTyping(false);
    };

    const onConnectError = (
      error
    ) => {
      console.error(
        "Socket connection error:",
        error?.message
      );

      setConnected(false);
    };

    /* =====================================================
       PRESENCE
    ===================================================== */

    const onUserOnline = ({
      userId,
    }) => {
      setOnline((prev) => ({
        ...prev,
        [String(userId)]: true,
      }));
    };

    const onUserOffline = ({
      userId,
    }) => {
      setOnline((prev) => ({
        ...prev,
        [String(userId)]: false,
      }));
    };

    /* =====================================================
       NEW MESSAGE
    ===================================================== */

    const onNewMessage = (
      message
    ) => {
      if (!message) return;

      const incomingConversationId =
        idOf(
          message?.conversation
        );

      const currentConversationId =
        idOf(
          conversationRef.current
        );

      /*
        Only current open chat
      */
      if (
        !currentConversationId ||
        incomingConversationId !==
          currentConversationId
      ) {
        return;
      }

      const incomingMessageId =
        idOf(message);

      const incomingLocalId =
        message?.localId ??
        message?._localId ??
        null;

      const incomingSenderId =
        idOf(
          message?.sender ??
            message?.senderId ??
            message?.sender_id ??
            message?.userId ??
            message?.user_id
        );

      const incomingReceiverId =
        idOf(
          message?.receiver ??
            message?.receiverId ??
            message?.receiver_id
        );

      setMessages((prev) => {
        /*
        ====================================================
        1. EXACT localId MATCH

        This is the primary duplicate fix.
        ====================================================
        */

        if (incomingLocalId) {
          const localIndex =
            prev.findIndex(
              (item) =>
                item?._localId ===
                incomingLocalId
            );

          if (localIndex !== -1) {
            const next = [
              ...prev,
            ];

            next[localIndex] = {
              ...message,
              _localId:
                undefined,
              localId:
                undefined,
              status:
                message?.read
                  ? "read"
                  : "sent",
            };

            return next;
          }
        }

        /*
        ====================================================
        2. Fallback temporary match

        For backend versions that don't return localId.
        ====================================================
        */

        const temporaryIndex =
          prev.findIndex(
            (item) => {
              if (
                !item?._localId
              ) {
                return false;
              }

              const itemSenderId =
                idOf(
                  item?.sender ??
                    item?.senderId ??
                    item?.sender_id
                );

              const itemReceiverId =
                idOf(
                  item?.receiver ??
                    item?.receiverId ??
                    item?.receiver_id
                );

              return (
                itemSenderId ===
                  incomingSenderId &&
                itemReceiverId ===
                  incomingReceiverId &&
                item?.text ===
                  message?.text &&
                (
                  item?.status ===
                    "sending" ||
                  item?.status ===
                    "pending"
                )
              );
            }
          );

        if (
          temporaryIndex !== -1
        ) {
          const next = [
            ...prev,
          ];

          next[
            temporaryIndex
          ] = {
            ...message,
            _localId:
              undefined,
            localId:
              undefined,
            status:
              message?.read
                ? "read"
                : "sent",
          };

          return next;
        }

        /*
        ====================================================
        3. Server _id duplicate
        ====================================================
        */

        if (
          incomingMessageId &&
          prev.some(
            (item) =>
              idOf(item) ===
              incomingMessageId
          )
        ) {
          return prev;
        }

        /*
        ====================================================
        4. VERY IMPORTANT

        Server echo of OUR OWN message must never
        become a second incoming message.

        This prevents:

             hi              <- duplicate LEFT
                                  hi -> RIGHT
        ====================================================
        */

        if (
          incomingSenderId ===
          currentUserId
        ) {
          return prev;
        }

        /*
        ====================================================
        5. Actual receiver message

        Other user's message = LEFT
        ====================================================
        */

        return [
          ...prev,
          {
            ...message,
            status:
              message?.read
                ? "read"
                : "sent",
          },
        ];
      });

      /*
      ======================================================
      Mark incoming message read
      ======================================================
      */

      if (
        incomingSenderId ===
          idOf(
            selectedRef.current
          ) &&
        incomingReceiverId ===
          currentUserId
      ) {
        socket.emit(
          "message:read",
          {
            conversationId:
              incomingConversationId,
          }
        );
      }
    };

    /* =====================================================
       READ RECEIPTS
    ===================================================== */

    const onMessageRead = ({
      messageIds = [],
    }) => {
      const ids = new Set(
        messageIds.map(String)
      );

      setMessages((prev) =>
        prev.map((message) =>
          ids.has(
            idOf(message)
          )
            ? {
                ...message,
                read: true,
                status: "read",
              }
            : message
        )
      );
    };

    /* =====================================================
       MESSAGE FAILED
    ===================================================== */

    const onMessageFailed = ({
      localId,
    }) => {
      setMessages((prev) =>
        prev.map((message) =>
          message?._localId ===
          localId
            ? {
                ...message,
                status:
                  "pending",
              }
            : message
        )
      );

      setSending(false);
    };

    /* =====================================================
       TYPING
    ===================================================== */

    const onTypingStart = ({
      userId,
    }) => {
      if (
        idOf(
          selectedRef.current
        ) === String(userId)
      ) {
        setTyping(true);
      }
    };

    const onTypingStop = ({
      userId,
    }) => {
      if (
        idOf(
          selectedRef.current
        ) === String(userId)
      ) {
        setTyping(false);
      }
    };

    /* =====================================================
       REGISTER EVENTS
    ===================================================== */

    socket.on(
      "connect",
      onConnect
    );

    socket.on(
      "disconnect",
      onDisconnect
    );

    socket.on(
      "connect_error",
      onConnectError
    );

    socket.on(
      "user:online",
      onUserOnline
    );

    socket.on(
      "user:offline",
      onUserOffline
    );

    socket.on(
      "message:new",
      onNewMessage
    );

    socket.on(
      "message:read",
      onMessageRead
    );

    socket.on(
      "message:failed",
      onMessageFailed
    );

    socket.on(
      "typing:start",
      onTypingStart
    );

    socket.on(
      "typing:stop",
      onTypingStop
    );

    /* =====================================================
       CLEANUP
    ===================================================== */

    return () => {
      socket.off(
        "connect",
        onConnect
      );

      socket.off(
        "disconnect",
        onDisconnect
      );

      socket.off(
        "connect_error",
        onConnectError
      );

      socket.off(
        "user:online",
        onUserOnline
      );

      socket.off(
        "user:offline",
        onUserOffline
      );

      socket.off(
        "message:new",
        onNewMessage
      );

      socket.off(
        "message:read",
        onMessageRead
      );

      socket.off(
        "message:failed",
        onMessageFailed
      );

      socket.off(
        "typing:start",
        onTypingStart
      );

      socket.off(
        "typing:stop",
        onTypingStop
      );
    };
  }, [
    currentUserId,
  ]);

  /* =======================================================
     AUTO SCROLL
  ======================================================= */

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    messages,
    typing,
  ]);

  /* =======================================================
     TIMER CLEANUP
  ======================================================= */

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(
          typingTimer.current
        );
      }
    };
  }, []);

  /* =======================================================
     MARK CONVERSATION READ
  ======================================================= */

  const markConversationRead =
    useCallback(
      (conversationId) => {
        if (
          socket.connected &&
          conversationId
        ) {
          socket.emit(
            "message:read",
            {
              conversationId,
            }
          );
        }
      },
      []
    );

  /* =======================================================
     OPEN USER
  ======================================================= */

  const openUser = async (
    chatUser
  ) => {
    if (!chatUser?._id) {
      return;
    }

    /*
      Already opened
    */
    if (
      idOf(selected) ===
        idOf(chatUser) &&
      conversation
    ) {
      setMobile(true);

      markConversationRead(
        conversation._id
      );

      return;
    }

    /*
      Request ID prevents an older API response
      from overwriting a newer selected chat.
    */
    const requestId =
      ++openingConversationRef.current;

    setSelected(chatUser);
    selectedRef.current =
      chatUser;

    setMobile(true);
    setMenuOpen(false);
    setTyping(false);

    setMessages([]);
    setConversation(null);
    setLoadingMessages(true);

    try {
      /*
      ======================================================
      GET / CREATE CONVERSATION
      ======================================================
      */

      const { data } =
        await api.post(
          "/conversations",
          {
            userId:
              chatUser._id,
          }
        );

      if (
        requestId !==
        openingConversationRef.current
      ) {
        return;
      }

      const currentConversation =
        data?.conversation;

      if (
        !currentConversation?._id
      ) {
        throw new Error(
          "Conversation not found"
        );
      }

      setConversation(
        currentConversation
      );

      conversationRef.current =
        currentConversation;

      /*
      ======================================================
      JOIN SOCKET ROOM
      ======================================================
      */

      if (socket.connected) {
        socket.emit(
          "conversation:join",
          {
            conversationId:
              currentConversation._id,
          }
        );
      }

      /*
      ======================================================
      LOAD HISTORY
      ======================================================
      */

      const history =
        await api.get(
          `/messages/${currentConversation._id}`
        );

      if (
        requestId !==
        openingConversationRef.current
      ) {
        return;
      }

      const historyMessages =
        (
          history.data?.messages ||
          []
        ).map((message) => ({
          ...message,
          status:
            message?.read
              ? "read"
              : "sent",
        }));

      /*
        Remove duplicate IDs
      */
      const uniqueMessages = [];

      const seenIds =
        new Set();

      historyMessages.forEach(
        (message) => {
          const messageId =
            idOf(message);

          if (
            messageId &&
            seenIds.has(
              messageId
            )
          ) {
            return;
          }

          if (messageId) {
            seenIds.add(
              messageId
            );
          }

          uniqueMessages.push(
            message
          );
        }
      );

      setMessages(
        uniqueMessages
      );

      markConversationRead(
        currentConversation._id
      );
    } catch (error) {
      console.error(
        "Failed to open conversation:",
        error
      );

      setMessages([]);
    } finally {
      if (
        requestId ===
        openingConversationRef.current
      ) {
        setLoadingMessages(
          false
        );
      }
    }
  };

  /* =======================================================
     HANDLE TYPING
  ======================================================= */

  const handleTyping = (
    value
  ) => {
    if (
      value.length > 5000
    ) {
      return;
    }

    setText(value);

    if (
      !conversation?._id ||
      !socket.connected
    ) {
      return;
    }

    socket.emit(
      "typing:start",
      {
        conversationId:
          conversation._id,
      }
    );

    if (typingTimer.current) {
      clearTimeout(
        typingTimer.current
      );
    }

    typingTimer.current =
      setTimeout(() => {
        socket.emit(
          "typing:stop",
          {
            conversationId:
              conversation._id,
          }
        );
      }, 700);
  };

  /* =======================================================
     SEND MESSAGE
  ======================================================= */

  const sendMessage = (
    event
  ) => {
    event.preventDefault();

    const value =
      text.trim();

    if (
      !value ||
      !conversation?._id ||
      !selected?._id ||
      sending
    ) {
      return;
    }

    const localId =
      `local-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    /*
      IMPORTANT:
      sender = logged-in user
      therefore isMine = true
      therefore RIGHT
    */
    const senderId =
      currentUserId;

    /*
    ======================================================
    OFFLINE MESSAGE
    ======================================================
    */

    if (!socket.connected) {
      const offlineMessage = {
        _id: localId,
        _localId: localId,

        conversation:
          conversation._id,

        sender:
          senderId,

        receiver:
          selected._id,

        text: value,

        createdAt:
          new Date().toISOString(),

        status: "pending",

        message_type:
          "text",
      };

      setMessages((prev) => [
        ...prev,
        offlineMessage,
      ]);

      setText("");

      return;
    }

    /*
    ======================================================
    OPTIMISTIC MESSAGE
    ======================================================
    */

    const optimisticMessage = {
      _id: localId,
      _localId: localId,

      conversation:
        conversation._id,

      sender:
        senderId,

      receiver:
        selected._id,

      text: value,

      createdAt:
        new Date().toISOString(),

      status: "sending",

      message_type:
        "text",
    };

    setSending(true);

    setMessages((prev) => [
      ...prev,
      optimisticMessage,
    ]);

    /*
    ======================================================
    SEND TO SOCKET
    ======================================================
    */

    socket.emit(
      "message:send",
      {
        conversationId:
          conversation._id,

        receiverId:
          selected._id,

        text: value,

        message_type:
          "text",

        /*
          Backend must return this same localId
          through message:new
        */
        localId,
      },
      (result) => {
        setSending(false);

        /*
          Message failed
        */
        if (
          !result?.success
        ) {
          setMessages((prev) =>
            prev.map((message) =>
              message?._localId ===
              localId
                ? {
                    ...message,
                    status:
                      "pending",
                  }
                : message
            )
          );
        }
      }
    );

    setText("");
    setTyping(false);

    socket.emit(
      "typing:stop",
      {
        conversationId:
          conversation._id,
      }
    );

    if (typingTimer.current) {
      clearTimeout(
        typingTimer.current
      );
    }
  };

  /* =======================================================
     CLEAR CONVERSATION
  ======================================================= */

  const clearConversation =
    async () => {
      if (!conversation?._id) {
        return;
      }

      const confirmed =
        window.confirm(
          "Are you sure you want to clear this conversation?"
        );

      if (!confirmed) {
        return;
      }

      try {
        await api.delete(
          `/messages/${conversation._id}`
        );

        /*
          UI clear
        */
        setMessages([]);

        /*
          Menu close
        */
        setMenuOpen(false);

        /*
          Scroll bottom
        */
        setTimeout(() => {
          endRef.current?.scrollIntoView({
            behavior:
              "smooth",
            block: "end",
          });
        }, 0);
      } catch (error) {
        console.error(
          "Clear conversation error:",
          error
        );

        window.alert(
          error?.response?.data
            ?.message ||
            "Failed to clear conversation"
        );
      }
    };

  /* =======================================================
     STATUS ICON
  ======================================================= */

  const statusIcon = (
    message
  ) => {
    /*
      Never show sender status
      on receiver messages.
    */
    if (
      !isMine(message)
    ) {
      return null;
    }

    if (
      message?.status ===
      "pending"
    ) {
      return (
        <Clock3
          size={13}
          className="
            animate-pulse
            text-amber-300
          "
          title="Waiting for network"
        />
      );
    }

    if (
      message?.status ===
        "read" ||
      message?.read
    ) {
      return (
        <CheckCheck
          size={14}
          className="text-cyan-200"
          title="Seen"
        />
      );
    }

    return (
      <Check
        size={14}
        className="text-white/60"
        title="Sent"
      />
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="
        chat-shell
        relative
        flex
        h-[100dvh]
        min-h-0
        overflow-hidden
        bg-slate-950
        text-slate-100
      "
    >
      {/* ==================================================
          BACKGROUND
      ================================================== */}

      <div
        className="
          ambient
          ambient-one
          pointer-events-none
        "
      />

      <div
        className="
          ambient
          ambient-two
          pointer-events-none
        "
      />

      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside
        className={`
          ${
            mobile
              ? "hidden md:flex"
              : "flex"
          }

          chat-sidebar
          relative
          z-10
          h-full
          w-full
          shrink-0
          flex-col
          overflow-hidden
          border-r
          border-white/10
          bg-slate-900/90
          backdrop-blur-2xl

          md:w-[340px]
          lg:w-[380px]
        `}
      >
        {/* Sidebar header */}
        <div className="shrink-0 px-5 pb-3 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xl font-black tracking-tight">
                <span className="brand-orb">
                  <MessageCircle
                    size={18}
                  />
                </span>

                Messages
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Private conversations
              </p>
            </div>

            <button
              type="button"
              className="icon glass-button"
              onClick={logout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Current user */}
        <div
          className="
            mx-4
            mb-3
            flex
            shrink-0
            items-center
            gap-3
            rounded-2xl
            border
            border-white/5
            bg-white/[0.035]
            p-3
            shadow-xl
            shadow-black/10
          "
        >
          <div className="relative shrink-0">
            <img
              src={avatar(user)}
              className="
                h-10
                w-10
                rounded-full
                object-cover
                ring-2
                ring-indigo-400/20
              "
              alt="Your avatar"
            />

            <span className="online-dot absolute bottom-0 right-0" />
          </div>

          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm">
              {user?.fullName ||
                "You"}
            </b>

            <span className="text-xs text-emerald-400">
              Active now
            </span>
          </div>

          <Sparkles
            size={16}
            className="shrink-0 text-indigo-400"
          />
        </div>

        {/* Search */}
        <div
          className="
            search-box
            mx-4
            mb-3
            flex
            shrink-0
            items-center
            gap-2
            rounded-2xl
            border
            border-white/10
            bg-black/20
            px-3
          "
        >
          <Search
            size={17}
            className="shrink-0 text-slate-500"
          />

          <input
            className="
              min-w-0
              w-full
              bg-transparent
              py-3
              text-sm
              outline-none
            "
            placeholder="Search people…"
            value={query}
            onChange={(e) =>
              setQuery(
                e.target.value
              )
            }
          />

          {query && (
            <button
              type="button"
              className="
                shrink-0
                text-xs
                text-slate-500
                hover:text-white
              "
              onClick={() =>
                setQuery("")
              }
            >
              Clear
            </button>
          )}
        </div>

        {/* Contacts title */}
        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            px-5
            pb-2
          "
        >
          <span
            className="
              text-[11px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-slate-600
            "
          >
            Contacts
          </span>

          <span className="text-xs text-slate-600">
            {filteredUsers.length}
          </span>
        </div>

        {/* Contacts */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            px-2
            pb-4
          "
        >
          {loadingUsers ? (
            <div className="space-y-2 px-2 pt-2">
              {[
                1,
                2,
                3,
                4,
                5,
              ].map((i) => (
                <div
                  key={i}
                  className="skeleton-row"
                />
              ))}
            </div>
          ) : filteredUsers.length ===
            0 ? (
            <div className="px-5 py-12 text-center">
              <div
                className="
                  mx-auto
                  mb-3
                  grid
                  h-12
                  w-12
                  place-items-center
                  rounded-2xl
                  bg-white/5
                  text-slate-600
                "
              >
                <Search
                  size={20}
                />
              </div>

              <p className="text-sm text-slate-500">
                No people found
              </p>
            </div>
          ) : (
            filteredUsers.map(
              (chatUser) => (
                <button
                  type="button"
                  key={
                    chatUser._id
                  }
                  onClick={() =>
                    openUser(
                      chatUser
                    )
                  }
                  className={`
                    user-row
                    group
                    flex
                    w-full
                    items-center
                    gap-3
                    rounded-2xl
                    p-3
                    text-left

                    ${
                      idOf(
                        selected
                      ) ===
                      idOf(
                        chatUser
                      )
                        ? "active"
                        : ""
                    }
                  `}
                >
                  <span className="relative shrink-0">
                    <img
                      src={avatar(
                        chatUser
                      )}
                      className="
                        h-12
                        w-12
                        rounded-full
                        object-cover
                        ring-1
                        ring-white/10
                        transition
                        duration-300
                        group-hover:scale-105
                      "
                      alt={
                        chatUser.fullName
                      }
                    />

                    {isOnline(
                      chatUser
                    ) && (
                      <span className="online-dot absolute bottom-0 right-0" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm text-slate-200">
                      {
                        chatUser.fullName
                      }
                    </b>

                    <span
                      className={`
                        mt-1
                        block
                        truncate
                        text-xs

                        ${
                          isOnline(
                            chatUser
                          )
                            ? "text-emerald-400/80"
                            : "text-slate-500"
                        }
                      `}
                    >
                      {isOnline(
                        chatUser
                      )
                        ? "Online now"
                        : chatUser.bio ||
                          "Offline"}
                    </span>
                  </span>

                  <span
                    className={`
                      h-2
                      w-2
                      shrink-0
                      rounded-full

                      ${
                        isOnline(
                          chatUser
                        )
                          ? "bg-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,.7)]"
                          : "bg-slate-700"
                      }
                    `}
                  />
                </button>
              )
            )
          )}
        </div>
      </aside>

      {/* ==================================================
          MAIN CHAT
      ================================================== */}

      <main
        className={`
          ${
            mobile
              ? "flex"
              : "hidden md:flex"
          }

          relative
          z-20
          min-h-0
          min-w-0
          flex-1
          flex-col
          overflow-visible
        `}
      >
        {!selected ? (
          /* =================================================
             EMPTY
          ================================================= */

          <div
            className="
              welcome-screen
              grid
              min-h-0
              flex-1
              place-items-center
              p-8
              text-center
            "
          >
            <div className="max-w-md animate-float-in">
              <div
                className="
                  welcome-orb
                  mx-auto
                  mb-6
                  grid
                  h-24
                  w-24
                  place-items-center
                  rounded-[2rem]
                  text-indigo-300
                "
              >
                <MessageCircle
                  size={42}
                />
              </div>

              <div
                className="
                  mb-2
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/10
                  bg-white/5
                  px-3
                  py-1
                  text-xs
                  text-slate-400
                "
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                Real-time messaging
              </div>

              <h1
                className="
                  text-3xl
                  font-black
                  tracking-tight
                  sm:text-4xl
                "
              >
                Start a conversation
              </h1>

              <p
                className="
                  mx-auto
                  mt-3
                  max-w-sm
                  text-sm
                  leading-6
                  text-slate-500
                "
              >
                Pick someone from your
                contacts and send a
                message.
              </p>
            </div>
          </div>
        ) : (
          /* =================================================
             ACTIVE CHAT
          ================================================= */

          <div
            className="
              relative
              flex
              min-h-0
              flex-1
              flex-col
              overflow-visible
            "
          >
            {/* =================================================
                HEADER
            ================================================= */}

            <header
              className="
                chat-header
                relative
                z-[1000]
                flex
                min-h-[76px]
                shrink-0
                items-center
                justify-between
                overflow-visible
                border-b
                border-white/10
                bg-slate-900/95
                px-3
                backdrop-blur-xl
                sm:px-5
              "
            >
              {/* Selected user */}
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="
                    icon
                    glass-button
                    shrink-0
                    md:hidden
                  "
                  onClick={() => {
                    setMobile(
                      false
                    );
                    setMenuOpen(
                      false
                    );
                  }}
                  title="Back"
                >
                  <ArrowLeft />
                </button>

                <div className="relative shrink-0">
                  <img
                    src={avatar(
                      selected
                    )}
                    className="
                      h-11
                      w-11
                      rounded-full
                      object-cover
                      ring-2
                      ring-indigo-400/20
                    "
                    alt={
                      selected.fullName
                    }
                  />

                  {isOnline(
                    selected
                  ) && (
                    <span className="online-dot absolute bottom-0 right-0" />
                  )}
                </div>

                <div className="min-w-0">
                  <b className="block truncate text-sm sm:text-base">
                    {
                      selected.fullName
                    }
                  </b>

                  <span className="flex items-center gap-1.5 text-xs">
                    {typing ? (
                      <>
                        <span className="typing-mini">
                          <i />
                          <i />
                          <i />
                        </span>

                        <span className="text-indigo-300">
                          typing…
                        </span>
                      </>
                    ) : isOnline(
                        selected
                      ) ? (
                      <>
                        <span
                          className="
                            h-1.5
                            w-1.5
                            rounded-full
                            bg-emerald-400
                            shadow-[0_0_8px_rgba(52,211,153,.8)]
                          "
                        />

                        <span className="text-emerald-400">
                          Online
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">
                        Offline
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Header actions */}
              <div
                className="
                  relative
                  z-[2000]
                  flex
                  shrink-0
                  items-center
                  gap-1
                "
              >
                <button
                  type="button"
                  className="
                    icon
                    glass-button
                    hidden
                    sm:grid
                  "
                  title="Voice call"
                >
                  <Phone size={18} />
                </button>

                <button
                  type="button"
                  className="
                    icon
                    glass-button
                    hidden
                    sm:grid
                  "
                  title="Video call"
                >
                  <Video size={18} />
                </button>

                <button
                  type="button"
                  className="
                    icon
                    glass-button
                  "
                  title="More options"
                  onClick={() =>
                    setMenuOpen(
                      (prev) =>
                        !prev
                    )
                  }
                >
                  <MoreVertical
                    size={19}
                  />
                </button>

                {/* =================================================
                    DROPDOWN
                ================================================= */}

                {menuOpen && (
                  <div
                    className="
                      absolute
                      right-0
                      top-[calc(100%+8px)]
                      z-[99999]
                      w-48
                      max-w-[calc(100vw-24px)]
                      overflow-hidden
                      rounded-2xl
                      border
                      border-white/10
                      bg-slate-900
                      p-1.5
                      shadow-[0_20px_60px_rgba(0,0,0,.65)]
                      backdrop-blur-2xl
                      animate-menu-in
                    "
                  >
                    <button
                      type="button"
                      className="
                        menu-item
                        w-full
                        text-left
                      "
                      onClick={() =>
                        setMenuOpen(
                          false
                        )
                      }
                    >
                      View profile
                    </button>

                    <button
                      type="button"
                      className="
                        menu-item
                        w-full
                        text-left
                      "
                      onClick={() =>
                        setMenuOpen(
                          false
                        )
                      }
                    >
                      Mute notifications
                    </button>

                    <button
                      type="button"
                      className="
                        menu-item
                        w-full
                        text-left
                        text-rose-300
                      "
                      onClick={
                        clearConversation
                      }
                    >
                      Clear conversation
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* =================================================
                NETWORK
            ================================================= */}

            {!connected && (
              <div
                className="
                  relative
                  z-50
                  flex
                  shrink-0
                  items-center
                  justify-center
                  gap-2
                  border-b
                  border-amber-400/10
                  bg-amber-400/[0.06]
                  px-3
                  py-2
                  text-center
                  text-xs
                  text-amber-200
                "
              >
                <WifiOff
                  size={14}
                />

                <span>
                  Network disconnected —
                  new messages will show a
                  clock until connection
                  returns.
                </span>
              </div>
            )}

            {/* =================================================
                MESSAGES
            ================================================= */}

            <section
              className="
                messages-area
                relative
                z-0
                min-h-0
                flex-1
                overflow-y-auto
                overflow-x-hidden
                px-3
                py-6
                sm:px-8
              "
            >
              <div
                className="
                  mx-auto
                  flex
                  min-h-full
                  w-full
                  max-w-4xl
                  flex-col
                  justify-end
                "
              >
                {loadingMessages ? (
                  <div className="grid flex-1 place-items-center">
                    <div className="loader-ring" />
                  </div>
                ) : messages.length ===
                  0 ? (
                  <div className="grid flex-1 place-items-center text-center">
                    <div className="animate-float-in">
                      <div
                        className="
                          mx-auto
                          mb-3
                          grid
                          h-14
                          w-14
                          place-items-center
                          rounded-2xl
                          bg-indigo-500/10
                          text-indigo-400
                        "
                      >
                        <MessageCircle
                          size={24}
                        />
                      </div>

                      <p className="text-sm font-semibold text-slate-400">
                        No messages yet
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Say hello to{" "}
                        {
                          selected.fullName
                        }.
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map(
                    (
                      message,
                      index
                    ) => {
                      const mine =
                        isMine(
                          message
                        );

                      return (
                        <div
                          key={
                            message?._id ||
                            message?._localId ||
                            `${message?.createdAt}-${index}`
                          }
                          className={`
                            mb-2
                            flex
                            w-full
                            items-end
                            gap-2

                            ${
                              mine
                                ? "justify-end"
                                : "justify-start"
                            }
                          `}
                        >
                          {/* =================================================
                              OTHER USER
                              LEFT SIDE
                          ================================================= */}

                          {!mine && (
                            <img
                              src={avatar(
                                selected
                              )}
                              className="
                                mb-1
                                h-7
                                w-7
                                shrink-0
                                rounded-full
                                object-cover
                                ring-1
                                ring-white/10
                              "
                              alt={
                                selected.fullName
                              }
                            />
                          )}

                          {/* =================================================
                              BUBBLE
                          ================================================= */}

                          <div
                            className={`
                              message-bubble
                              w-fit
                              max-w-[82%]
                              break-words
                              rounded-2xl
                              px-3.5
                              py-2.5
                              text-sm
                              shadow-xl
                              sm:max-w-[70%]

                              ${
                                mine
                                  ? "message-mine rounded-br-sm"
                                  : "message-other rounded-bl-sm"
                              }
                            `}
                          >
                            <div className="break-words leading-5">
                              {
                                message?.text
                              }
                            </div>

                            <div
                              className="
                                mt-1
                                flex
                                items-center
                                justify-end
                                gap-1
                                text-[10px]
                                opacity-70
                              "
                            >
                              {message?.status ===
                                "pending" && (
                                <span className="text-amber-200">
                                  Waiting
                                </span>
                              )}

                              <span>
                                {timeLabel(
                                  message?.createdAt
                                )}
                              </span>

                              {mine &&
                                statusIcon(
                                  message
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )
                )}

                {/* =================================================
                    TYPING
                ================================================= */}

                {typing && (
                  <div
                    className="
                      mb-2
                      flex
                      w-full
                      items-end
                      justify-start
                      gap-2
                      animate-message-in
                    "
                  >
                    <img
                      src={avatar(
                        selected
                      )}
                      className="
                        h-7
                        w-7
                        shrink-0
                        rounded-full
                        object-cover
                      "
                      alt={
                        selected.fullName
                      }
                    />

                    <div
                      className="
                        message-other
                        flex
                        items-center
                        gap-1
                        rounded-2xl
                        rounded-bl-sm
                        px-4
                        py-3
                      "
                    >
                      <i className="typing-dot" />
                      <i className="typing-dot" />
                      <i className="typing-dot" />
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            </section>

            {/* =================================================
                COMPOSER
            ================================================= */}

            <form
              onSubmit={
                sendMessage
              }
              className="
                composer
                relative
                z-10
                shrink-0
                border-t
                border-white/10
                bg-slate-900/95
                p-3
                backdrop-blur-xl
                sm:p-4
              "
            >
              <div
                className="
                  mx-auto
                  flex
                  w-full
                  max-w-4xl
                  items-center
                  gap-2
                "
              >
                {/* Emoji */}
                <button
                  type="button"
                  className="
                    icon
                    glass-button
                    hidden
                    shrink-0
                    sm:grid
                  "
                  title="Emoji"
                >
                  <Smile size={18} />
                </button>

                {/* Input */}
                <div
                  className="
                    composer-input
                    flex
                    min-w-0
                    flex-1
                    items-center
                    rounded-2xl
                    border
                    border-white/10
                    bg-slate-950/80
                    px-4
                  "
                >
                  <input
                    type="text"
                    maxLength={5000}
                    value={text}
                    onChange={(e) =>
                      handleTyping(
                        e.target.value
                      )
                    }
                    placeholder={
                      connected
                        ? "Write a message…"
                        : "Offline — type to queue"
                    }
                    className="
                      min-w-0
                      w-full
                      bg-transparent
                      py-3
                      text-sm
                      outline-none
                    "
                  />

                  {text && (
                    <span
                      className="
                        mr-2
                        shrink-0
                        whitespace-nowrap
                        text-[10px]
                        text-slate-600
                      "
                    >
                      {text.length}/5000
                    </span>
                  )}
                </div>

                {/* Send */}
                <button
                  type="submit"
                  disabled={
                    !text.trim() ||
                    !conversation ||
                    sending
                  }
                  className="
                    send-button
                    grid
                    h-11
                    w-11
                    shrink-0
                    place-items-center
                    rounded-2xl
                    text-white
                    shadow-lg
                    disabled:cursor-not-allowed
                    disabled:opacity-35
                  "
                  title="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}