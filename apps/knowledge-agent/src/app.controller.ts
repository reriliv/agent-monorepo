import { Controller, Get, Post, Sse } from '@nestjs/common';
import { AppService } from './app.service';
import { Subject } from 'rxjs/internal/Subject';
import { Observable } from 'rxjs/internal/Observable';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
