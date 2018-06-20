package com.xiaobeiy.system;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.ManyToOne;
import javax.persistence.Version;

import lombok.Data;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Data
@Entity
public class Client {

	private @Id @GeneratedValue Long id;
	private String firstName;
	private String lastName;
	private String address;
	private String phoneNumber;
	private String email;

	private @Version @JsonIgnore Long version;

	private @ManyToOne Manager manager;

	private Client() {}

	public Client(String firstName, String lastName, String address, String phoneNumber, String email, Manager manager) {
		this.firstName = firstName;
		this.lastName = lastName;
		this.address = address;
		this.phoneNumber = phoneNumber;
		this.email = email;
		this.manager = manager;
	}
}
