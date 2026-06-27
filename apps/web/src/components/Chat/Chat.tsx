import { useCallback, useState } from "react";

export const Chat = () => {
  const [message, setMessage] = useState("");

  const handleSendMessage: React.MouseEventHandler<HTMLButtonElement> =
    useCallback(
      async (e) => {
        e.preventDefault();
        const eventSource = new EventSource("/agent/sse");
        eventSource.onmessage = (event) => {
          console.log(event);
        };
        // try {
        //   const res = await fetch("/agent/chat/sse", {
        //     method: "POST",
        //     headers: { "Content-Type": "application/json" },
        //     body: JSON.stringify({ message }),
        //   });
        //   if (!res.ok) {
        //     throw new Error("请求失败");
        //   }

        //   const reader = res.body?.getReader();
        //   if (!reader) {
        //     throw new Error("浏览器不支持流式读取");
        //   }

        //   const decoder = new TextDecoder();
        //   let buffer = "";

        //   while (true) {
        //     const { done, value } = await reader.read();
        //     if (done) break;

        //     buffer += decoder.decode(value, { stream: true });

        //     const lines = buffer.split("\n");
        //     console.log("lines", lines);
        //     buffer = lines.pop() ?? "";

        //     for (const line of lines) {
        //       const trimmedLine = line.trim();
        //       console.log("trimmedLine", trimmedLine);
        //       if (trimmedLine.startsWith("data:")) {
        //         const dataStr = trimmedLine.slice(5).trim();

        //         let parsed: unknown;
        //         try {
        //           parsed = JSON.parse(dataStr);
        //         } catch (err) {
        //           console.error(err);
        //           console.log(dataStr);
        //           continue;
        //         }

        //         console.log("解析后的数据：", parsed);
        //       }
        //     }
        //   }
        // } catch (err) {
        //   console.error(err);
        // }
        // const messageEvent = new EventSource("/agent/chat");
        // messageEvent.onmessage = (event: MessageEvent) => {
        //   console.log(event);
        // };
      },
      [message],
    );

  return (
    <div>
      <h1>Chat</h1>
      <textarea
        className="border-black-100 border-1"
        name=""
        id=""
        onChange={(e) => setMessage(e.target.value)}
      ></textarea>
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
};

export default Chat;
