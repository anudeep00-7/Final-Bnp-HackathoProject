import { Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

function AIAssistant() {

  const navigate = useNavigate();

  return (
    <button
      className="ai-floating-button"
      onClick={() => navigate("/admin/ai-assistant")}
      title="AI Assistant"
    >

      <Bot size={25} />

      <span className="ai-pulse"></span>

    </button>
  );
}

export default AIAssistant;