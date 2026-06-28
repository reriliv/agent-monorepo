import { Injectable } from '@nestjs/common';
import { AgentState } from '../graph/state.dto';

@Injectable()
export class ConversationRouter {
  route(state: AgentState): string {
    const messages = state.messages;

    if (messages.length > 6) {
      return 'summarize_conversation';
    }
    return 'END';
  }
}
