import { Body, Controller, Get, Post, Sse } from '@nestjs/common';
import { AgentService } from './agent.service';
import { Observable, Subject } from 'rxjs';
import { CleanEvent, Conversation } from '@monorepo/shared';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('health')
  health() {
    return this.agentService.health();
  }

  @Get('conversations')
  async conversations(): Conversation[] {
    return [
      {
        createdAt: '',
        sessionId: '',
        summary: '',
        title: '',
        updatedAt: '',
      },
    ];
  }

  @Post('chat/sse')
  @Sse()
  chat(@Body() body: { message: string; sessionId?: string }) {
    const eventSubject = new Subject<CleanEvent>();

    this.agentService.chatSSE(eventSubject, body.message, body.sessionId);

    // const stream = this.agentService.chatSSE(eventSubject, body.message, body.sessionId);
    // console.log(stream);
    // const result: any[] = [];
    // for await (const chunk of stream) {
    //   result.push(chunk);
    // }
    // console.log('result');
    // console.log(result);
    // return { result };

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => subscriber.next({ data: event }),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });

      // eventSubject.next({
      //   type: 'message',
      //   content: 'sse connect',
      // });
    });
  }

  @Post('chat/pause')
  pause(@Body() body: { sessionId: string }) {
    this.agentService.cancelChat(body.sessionId);
    return null;
  }

  @Post('sse')
  @Sse()
  sse() {
    const eventSubject = new Subject<MessageEvent>();

    setTimeout(() => {
      eventSubject.next({
        data: '2000ms sleep done',
      } as MessageEvent);

      eventSubject.complete();
    }, 2000);

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => subscriber.next({ data: event }),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });

      eventSubject.next({
        type: 'start',
        data: 'sse connect',
      } as MessageEvent);
    });
  }
}
