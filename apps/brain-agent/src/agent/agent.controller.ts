import { Body, Controller, Post, Sse } from '@nestjs/common';
// import { AgentService } from './agent.service';
import { /* interval, map, */ Observable, Subject } from 'rxjs';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat/sse')
  @Sse()
  chat(@Body('message') message: string): Observable<MessageEvent> {
    console.log('message', message);
    const eventSubject = new Subject<MessageEvent>();

    this.agentService.process(message, eventSubject).catch((error) => {
      eventSubject.error(error);
    });

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => {
          subscriber.next({ data: event } as MessageEvent);
        },
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });
    });
  }

  @Sse('sse')
  sse(): Observable<MessageEvent> {
    const eventSubject = new Subject<MessageEvent>();

    setTimeout(() => {
      eventSubject.next({
        data: '1000ms sleep done',
      } as MessageEvent);
    }, 1000);

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => subscriber.next({ data: event } as MessageEvent),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });
      // subscriber.next({ data: 'sse' } as MessageEvent);
      // subscriber.complete();
    });
    // return interval(1000).pipe(map(() => ({ data: { hello: 'world' } })));
  }
}
