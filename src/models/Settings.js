import mongoose from 'mongoose';
import validator from 'validator';

var Schema = mongoose.Schema;
var settingsSchema = new Schema({
	issuesEnabled: boolean,
	isPublic: boolean,
});

var Settings = mongoose.model('Settings', settingsSchema);

export default Settings;