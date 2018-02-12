import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';

var Schema = mongoose.Schema;
var userSchema = new Schema({
	name: String,
	email: String,
	username: String,
	password: String
});

userSchema.methods.validate = function(callback){
	// TODO: validate values
	return callback(false, true);
}

/*
 * Verifies if username and password matches.
 * username: String - username
 * password: String - passsword
 * callback: Function
 *  - matches: Boolean - whether username password matches or not
 */
userSchema.statics.matches = function(username, password, callback){
	User.findOne({
		username: username
	}, (err, user) => {
		if(err) callback(false);
		bcrypt.compare(password, user.password, (err, matches) => {
			callback(matches);
		});
	});
}

var User = mongoose.model('User', userSchema);

export default User;