import { useState } from "react";
import { Bot, Send, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

function AIChat() {

  const navigate = useNavigate();

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! I'm your Corporate Actions AI Assistant. How can I help you?"
    }
  ]);

  const sendMessage = () => {

    if (!message.trim()) return;

    setMessages([
      ...messages,
      {
        type: "user",
        text: message
      },
      {
        type: "bot",
        text: "I'm currently in assistant mode. Backend AI integration can be connected here later."
      }
    ]);

    setMessage("");
  };


  const handleKeyDown = (e) => {

    if (e.key === "Enter") {
      sendMessage();
    }

  };


  return (
    <div className="ai-chat-page">

      {/* HEADER */}

      <div className="ai-chat-header">

        <button
          className="ai-back-button"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={20} />
        </button>

        <div className="ai-title">

          <div className="ai-header-icon">
            <Bot size={22} />
          </div>

          <div>
            <h2>AI Assistant</h2>
            <span>Corporate Actions Assistant</span>
          </div>

        </div>

      </div>


      {/* CHAT AREA */}

      <div className="ai-messages">

        {messages.map((msg, index) => (

          <div
            key={index}
            className={
              msg.type === "user"
                ? "chat-message user-message"
                : "chat-message bot-message"
            }
          >

            {msg.type === "bot" && (
              <div className="message-bot-icon">
                <Bot size={17} />
              </div>
            )}

            <div className="message-bubble">
              {msg.text}
            </div>

          </div>

        ))}

      </div>


      {/* INPUT */}

      <div className="ai-input-area">

        <input
          type="text"
          placeholder="Ask about portfolios, holdings or corporate actions..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          className="ai-send-button"
          onClick={sendMessage}
        >
          <Send size={19} />
        </button>

      </div>

    </div>
  );
}

export default AIChat;