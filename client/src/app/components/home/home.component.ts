import { BookmarksService } from './../../services/bookmarks.service';
import { AuthService } from './../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  verifyClicked = false;
  url: any;
  bookmarks: any;
  bookmarksError = false;
  updateRssError = false;
  updateRssSuccess = false;
  day = "Monday";
  time = {
    hour: 12,
    minute: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public authService: AuthService,
    private bookmarksService: BookmarksService,
  ) {
    // Get Params
    const params = this.route.snapshot.queryParams;

    console.log(params);

    if (!!params.token) {
      this.authService.saveToken(params.token);
      this.router.navigate(['/']);
    }

  }

  ngOnInit() {


    if (this.authService.isLoggedIn) {
      this.getLoggedInUserDetails();
    }


    this.authService.getAuthStateChange().subscribe((isLoggedIn) => {

      if (isLoggedIn) {
        this.getLoggedInUserDetails();
      }
    });
  }

  private getLoggedInUserDetails() {
    this.authService.getLoggedInUser().subscribe((data: any) => {
      this.authService.user = data.data;
      this.url = data.data.rss_link;
      if (data.data.rss_day)
        this.day = data.data.rss_day;
      if (data.data.rss_time)
        this.time = data.data.rss_time;
      if (!!this.url) {
        this.getBookmarks();
      }
    }, (error: any) => {
      if (error.status == 401) {
        this.authService.signOut();
        this.router.navigate(['/']);
        return;
      }
    });
  }

  signInWithTwitter() {

    window.location.href = environment.baseUrl + "twitter/authenticate"

    // this.authService.login().subscribe((data: any) => {

    //   console.log(data)

    //   window.location.href = data.redirect;

    // });
  }

  getBookmarks() {

    // this.verifyClicked = true;
    this.updateRssSuccess = false;

    this.bookmarksService.getBookmarksForUser(this.url).subscribe((data: any) => {
      this.bookmarks = data.data;
      this.bookmarksError = false;
      this.verifyClicked = true;

    }, (error: any) => {
      if (error.status == 401) {
        this.authService.signOut();
        this.router.navigate(['/']);
        return;
      }
      this.bookmarksError = true;
      this.verifyClicked = false;
    });
  }

  save() {

    console.log("saveLink", this.url);
    this.bookmarksService.updateRssDetails(this.url, this.day, this.time).subscribe((data: any) => {
      this.authService.user.rss_link = this.url;
      this.authService.user.rss_day = this.day;
      this.authService.user.rss_time = this.time;
      this.updateRssError = false;
      this.updateRssSuccess = true;
    }, (error: any) => {
      if (error.status == 401) {
        this.authService.signOut();
        this.router.navigate(['/']);
        return;
      }

      this.updateRssError = true;
      this.updateRssSuccess = false;

    });


  }

}
