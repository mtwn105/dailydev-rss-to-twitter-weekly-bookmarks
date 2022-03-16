import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookmarksService {

  constructor(
    private http: HttpClient
  ) { }


  getBookmarksForUser(url: string) {
    return this.http.get(environment.baseUrl + "api/bookmarks?url=" + url);
  }

  updateRssDetails(url: string, day: string, time: any) {
    return this.http.put(environment.baseUrl + "api/user/rss", { url, day, time });
  }

  postTweet() {
    return this.http.post(environment.baseUrl + "api/tweet", {});
  }

}
