import mongoose from 'mongoose';
import validator from 'validator';

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

var User = mongoose.model('User', userSchema);

export default User;