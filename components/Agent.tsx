"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();

  const [callStatus, setCallStatus] = useState<CallStatus>(
    CallStatus.INACTIVE
  );
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState("");

  // IMPORTANT: useRef component ke andar hona chahiye
  const messagesRef = useRef<SavedMessage[]>([]);

  useEffect(() => {
    const onCallStart = () => {
      console.log("CALL STARTED");
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      console.log("CALL ENDED");
      console.log("TYPE:", type);
      console.log("INTERVIEW ID:", interviewId);
      console.log("Messages in ref:", messagesRef.current.length);
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: Message) => {
      if (
        message.type === "transcript" &&
        message.transcriptType === "final"
      ) {
        console.log(
          "Final transcript:",
          message.role,
          message.transcript
        );

        const newMessage: SavedMessage = {
          role: message.role,
          content: message.transcript,
        };

        setMessages((prev) => [...prev, newMessage]);

        // Ref always latest value rakhega
        messagesRef.current = [...messagesRef.current, newMessage];
      }
    };

    const onSpeechStart = () => {
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const onError = (error: Error) => {
      console.error("Vapi Error:", error);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }
  }, [messages]);

  useEffect(() => {
    if (callStatus !== CallStatus.FINISHED) return;

    const handleGenerateFeedback = async () => {
      console.log(
        "Generating feedback with:",
        messagesRef.current
      );

      if (messagesRef.current.length === 0) {
        console.log("No transcript found");
        router.push("/");
        return;
      }

      const result = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: messages,
        feedbackId,
      });

      console.log("createFeedback result:", JSON.stringify(result, null, 2));

      if (result.success && result.feedbackId) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        router.push("/");
      }
    };

    const generateInterview = async () => {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "technical",
          role: "Frontend Developer",
          level: "Junior",
          techstack: "React,Next.js,TypeScript",
          amount: 5,
          userid: userId,
        }),
      });

      const data = await res.json();
      console.log("API RESULT:", data);

      if (data.success) {
        router.push(`/interview/${data.id}`);
      }
    };

    if (type === "generate") {
      generateInterview();
    } else {
      handleGenerateFeedback();
    }
  }, [
    callStatus,
    feedbackId,
    interviewId,
    router,
    type,
    userId,
  ]);

  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);

    // reset previous transcripts
    messagesRef.current = [];
    setMessages([]);

    if (type === "generate") {
      await vapi.start(
        process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!,
        {
          variableValues: {
            username: userName,
            userid: userId,
          },
        }
      );
    } else {
      let formattedQuestions = "";

      if (questions) {
        formattedQuestions = questions
          .map((q) => `- ${q}`)
          .join("\n");
      }

      await vapi.start(interviewer, {
        variableValues: {
          questions: formattedQuestions,
        },
      });
    }
  };

  const handleDisconnect = () => {
    console.log("Disconnect clicked");
    vapi.stop();
  };

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>

          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />

            <h3>{userName}</h3>
          </div>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button
            className="relative btn-call"
            onClick={handleCall}
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {callStatus === "INACTIVE" ||
              callStatus === "FINISHED"
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button
            className="btn-disconnect"
            onClick={handleDisconnect}
          >
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;