import { useState, useEffect, useRef } from 'react';
import './OnboardingChat.css';
import DiwaanSeal from './DiwaanSeal';

export default function OnboardingChat({ session, isThinking, onSendMessage, isMock = false }) {
  const [inputValue, setInputValue] = useState('');
  // Ref to the scrollable chat-history container (not the page)
  const chatHistoryRef = useRef(null);

  // Bug fix: scroll within the bounded .chat-history container, never on the page.
  // scrollIntoView() on the sentinel div scrolls the VIEWPORT, not the chat box.
  // Use scrollTop on the container instead.
  const scrollToBottom = () => {
    const el = chatHistoryRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.conversation, isThinking]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isThinking) return;

    if (isMock) {
      onSendMessage('Continue (Mocking User Input)');
    } else {
      if (!inputValue.trim()) return;
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="onboarding-chat">
      {/* chat-history is the bounded scrollable container */}
      <div className="chat-history" ref={chatHistoryRef}>
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
              <span className="dot-pulse" />
              <span className="dot-pulse" />
              <span className="dot-pulse" />
            </div>
          </div>
        )}
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
            <button type="submit" className="neumorph-primary" disabled={isThinking || !inputValue.trim()}>
              Send
            </button>
          </>
        )}
      </form>
    </div>
  );
}
