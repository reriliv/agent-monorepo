import { Injectable } from '@nestjs/common';
import { END } from '@langchain/langgraph';
import { GraphState } from '../graph/state.dto';

@Injectable()
export class ConversationRouter {
  route(state: GraphState): string {
    const messages = state.messages;
    if (messages.length === 0) {
      return END;
    }

    const lastMessage = messages[messages.length - 1];
    const lastMsgObj = lastMessage as unknown as { tool_calls?: Array<{ id: string; name: string; args: any }> };

    if (lastMsgObj.tool_calls && lastMsgObj.tool_calls.length > 0) {
      return 'tools';
    }

    return END;
  }
}
