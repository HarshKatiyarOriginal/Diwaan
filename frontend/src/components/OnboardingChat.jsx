import { useState, useEffect, useRef } from 'react';
import './OnboardingChat.css';
import DiwaanSeal from './DiwaanSeal';

export default function OnboardingChat({ session, isThinking, onSendMessage, isMock = false }) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.conversation, isThinking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isThinking) return;
    
    if (isMock) {
      // In mock mode, the payload text doesn't matter, it just advances the script.
      onSendMessage("Continue (Mocking User Input)");
    } else {
      if (!inputValue.trim()) return;
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="onboarding-chat">
      <div className="chat-history">
        {session.conversation.map((turn, idx) => (
          <div key={idx} className={`chat-bubble ${turn.role}`}>
            {turn.role === 'assistant' && (
              <div className="avatar-wrapper">
                <DiwaanSeal size="micro" />
              </div>
            )}
            <div className="message-content">
              {turn.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="chat-bubble assistant thinking">
            <div className="avatar-wrapper">
              <DiwaanSeal size="micro" state="generating" />
            </div>
            <div className="message-content">
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
              <span className="dot-pulse"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSubmit}>
        {isMock ? (
          <button type="submit" disabled={isThinking} className="mock-continue-btn" style={{ width: '100%', padding: '16px' }}>
            Continue Script →
          </button>
        ) : (
          <>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your answer here..."
              disabled={isThinking}
              autoFocus
            />
            <button type="submit" disabled={isThinking || !inputValue.trim()}>
              Send
            </button>
          </>
        )}
      </form>
    </div>
  );
}
