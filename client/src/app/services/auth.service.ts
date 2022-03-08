
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public user: any;

  authSubject = new BehaviorSubject<any>(false);
  authSubjectObservable = this.authSubject.asObservable();

  constructor(
    private http: HttpClient
  ) { }

  get isLoggedIn() {
    return !!localStorage.getItem('token');
  }

  login() {
    return this.http.get(environment.baseUrl + "twitter/authenticate");
  }

  saveToken(token: string) {
    localStorage.setItem('token', token);
    this.authSubject.next(true);
  }

  signOut() {
    localStorage.removeItem('token');
    this.authSubject.next(false);
  }

  getAuthStateChange() {
    return this.authSubjectObservable;
  }

  getLoggedInUser() {
    return this.http.get(environment.baseUrl + "api/user");
  }


}
